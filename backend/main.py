import os
import unicodedata
import random
from datetime import datetime, timedelta

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
import bcrypt

# ─── Módulos internos ────────────────────────────────────────────────────────
from app.database import models, schemas
from app.database.conexion import SessionLocal, engine, get_db
from enviocorreo import enviar_correo_verificacion

# Crea tablas automáticamente (TraficoVehicular + Usuarios)
models.Base.metadata.create_all(bind=engine)

# ─── Configuración ───────────────────────────────────────────────────────────
# Obtén tu API key GRATIS en: https://developer.tomtom.com  (2 500 req/día)
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")

# Coordenadas de las capitales de cada departamento de Guatemala
# Usadas para consultar el tráfico en tiempo real con TomTom
DEPTO_COORDS: dict[str, tuple[float, float]] = {
    "GUATEMALA":       (14.6349, -90.5069),
    "SACATEPEQUEZ":    (14.5586, -90.7346),
    "CHIMALTENANGO":   (14.6619, -90.8192),
    "ESCUINTLA":       (14.3028, -90.7856),
    "SANTA ROSA":      (14.2161, -90.2956),
    "SOLOLA":          (14.7744, -91.1825),
    "TOTONICAPAN":     (14.9103, -91.3617),
    "QUETZALTENANGO":  (14.8444, -91.5198),
    "SUCHITEPEQUEZ":   (14.5426, -91.5194),
    "RETALHULEU":      (14.5297, -91.6786),
    "SAN MARCOS":      (14.9658, -91.7956),
    "HUEHUETENANGO":   (15.3194, -91.4719),
    "QUICHE":          (15.0281, -91.1503),
    "BAJA VERAPAZ":    (15.1258, -90.3756),
    "ALTA VERAPAZ":    (15.4731, -90.3786),
    "PETEN":           (16.9236, -89.8908),
    "IZABAL":          (15.7303, -88.5967),
    "ZACAPA":          (14.9717, -89.5294),
    "CHIQUIMULA":      (14.7978, -89.5458),
    "JALAPA":          (14.6342, -89.9897),
    "JUTIAPA":         (14.2892, -89.8958),
    "EL PROGRESO":     (14.8556, -90.0711),
}

app = FastAPI(title="MapeoRutas API", version="2.0")
codigos_2fa: dict[str, str] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def limpiar_texto(texto: str) -> str:
    """Normaliza texto: mayúsculas, sin tildes, sin espacios extra."""
    if texto is None:
        return ""
    texto = str(texto).upper().strip()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


async def obtener_estado_tomtom(depto: str) -> str:
    """
    Consulta TomTom Traffic Flow API y retorna el estado del vial.
    Si no hay API key o falla, retorna string vacío para usar la lógica horaria.
    """
    if not TOMTOM_API_KEY:
        return ""
    coords = DEPTO_COORDS.get(depto)
    if not coords:
        return ""
    try:
        url = (
            f"https://api.tomtom.com/traffic/services/4/flowSegmentData"
            f"/absolute/10/json"
            f"?key={TOMTOM_API_KEY}&point={coords[0]},{coords[1]}"
        )
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            flow = resp.json().get("flowSegmentData", {})
            speed      = flow.get("currentSpeed", 0)
            free_speed = flow.get("freeFlowSpeed", 1) or 1
            ratio = speed / free_speed
            if ratio < 0.50:
                return "HORA PICO - Tráfico Pesado"
            elif ratio < 0.75:
                return "Tráfico Moderado"
            else:
                return "Fluidez Alta"
    except Exception:
        pass
    return ""


def estado_por_hora() -> tuple[str, float]:
    """Estado del vial y factor de carga según la hora actual."""
    hora = datetime.now().hour
    if (7 <= hora <= 9) or (17 <= hora <= 19):
        return "HORA PICO - Tráfico Pesado", random.uniform(0.15, 0.25)
    elif hora >= 22 or hora <= 5:
        return "Fluidez Alta - Madrugada", random.uniform(0.01, 0.03)
    else:
        return "Tráfico Moderado", random.uniform(0.05, 0.10)


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/api/registrar", response_model=schemas.UsuarioResponse)
def registrar_usuario(usuario: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    db_usuario = db.query(models.Usuario).filter(
        models.Usuario.Correo == usuario.Correo
    ).first()
    if db_usuario:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    hashed_pw = bcrypt.hashpw(
        usuario.Password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    nuevo = models.Usuario(
        Nombre=usuario.Nombre,
        Correo=usuario.Correo,
        password_hash=hashed_pw,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.post("/api/login")
def login(datos: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(
        models.Usuario.Nombre == datos.Nombre
    ).first()

    if not user or not bcrypt.checkpw(
        datos.Password.encode("utf-8"), user.password_hash.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    codigo = str(random.randint(100000, 999999))
    codigos_2fa[user.Nombre] = codigo

    if user.Correo:
        enviado = enviar_correo_verificacion(user.Correo, user.Nombre, codigo)
        print(f"Correo {'enviado' if enviado else 'FALLÓ'} → {user.Correo}, código: {codigo}")
    else:
        print(f"Usuario {user.Nombre} sin correo registrado.")

    print(f"\n*** SEGURIDAD ***\nCódigo para {user.Nombre}: {codigo}\n*****************\n")

    return {
        "status": "success",
        "mensaje": "Código enviado al correo",
        "usuario": user.Nombre,
        "token": "SESION_ACTIVA_" + user.Nombre,
    }


@app.post("/api/recuperar")
def recuperar_password(datos: schemas.RecuperarRequest, db: Session = Depends(get_db)):
    """Genera un código de 6 dígitos, lo guarda en la BD y lo envía por correo."""
    user = db.query(models.Usuario).filter(models.Usuario.Correo == datos.Correo).first()
    if not user:
        raise HTTPException(status_code=404, detail="Correo no encontrado")

    # Generar código
    codigo = str(random.randint(100000, 999999))
    user.CodigoRecuperacion = codigo
    user.FechaExpiracionCodigo = datetime.now() + timedelta(minutes=15)
    db.commit()

    # Enviar correo
    enviado = enviar_correo_verificacion(user.Correo, user.Nombre, codigo)
    
    if enviado:
        return {"status": "success", "mensaje": "Código enviado correctamente"}
    else:
        # Si falla el correo, igual mostramos el código en consola para pruebas
        print(f"DEBUG: Falló envío de correo. Código de recuperación: {codigo}")
        return {"status": "error", "mensaje": "No se pudo enviar el correo, pero el código se generó."}


@app.post("/api/reset-password")
def reset_password(datos: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(
        models.Usuario.Correo == datos.Correo,
        models.Usuario.CodigoRecuperacion == datos.Codigo,
    ).first()

    if not user or datetime.now() > user.FechaExpiracionCodigo:
        raise HTTPException(status_code=400, detail="Código inválido o expirado")

    user.password_hash = bcrypt.hashpw(
        datos.NuevaPassword.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    user.CodigoRecuperacion = None
    user.FechaExpiracionCodigo = None
    db.commit()
    return {"status": "success", "mensaje": "Contraseña actualizada correctamente"}


# ─── Tráfico ──────────────────────────────────────────────────────────────────

@app.get("/api/consultar/{departamento}")
async def consultar_trafico(
    departamento: str,
    usuario: str,
    codigo_ingresado: str,
    db: Session = Depends(get_db),
):
    """Retorna estado del vial y vehículos estimados ahora (TomTom + lógica horaria)."""
    if not usuario or not codigo_ingresado:
        raise HTTPException(status_code=403, detail="Faltan credenciales de sesión")

    if codigos_2fa.get(usuario) != codigo_ingresado.strip():
        raise HTTPException(status_code=403, detail="Código 2FA inválido")

    depto = limpiar_texto(departamento)

    # Total histórico desde SQL Server
    total: int = (
        db.query(sqlfunc.sum(models.TraficoVehicular.Cantidad))
        .filter(models.TraficoVehicular.Departamento == depto)
        .scalar()
        or 0
    )

    if total == 0:
        return {
            "error": "Sin datos para este departamento",
            "sugerencias": ["GUATEMALA", "SACATEPEQUEZ", "ESCUINTLA"],
        }

    # 1) Intentar TomTom para estado real
    estado = await obtener_estado_tomtom(depto)

    # 2) Fallback: lógica horaria
    if not estado:
        estado, factor = estado_por_hora()
    else:
        _, factor = estado_por_hora()

    vehiculos_ahora = int(total * factor)
    ahora = datetime.now()

    return {
        "departamento": depto,
        "hora_de_consulta": ahora.strftime("%H:%M"),
        "estado_del_vial": estado,
        "vehiculos_detectados_ahora": vehiculos_ahora,
        "total_historico_mes": int(total),
        "fuente_trafico": "TomTom" if TOMTOM_API_KEY else "Estimado",
    }


@app.get("/api/vehicular/{departamento}")
def get_vehicular(departamento: str, db: Session = Depends(get_db)):
    """
    Retorna el conteo de vehículos por tipo (CARRO, MOTO, CAMION, CAMIONETA, PICKUP)
    para el departamento indicado. Datos reales desde SQL Server.
    """
    depto = limpiar_texto(departamento)

    filas = (
        db.query(
            models.TraficoVehicular.TipoVehiculo,
            sqlfunc.sum(models.TraficoVehicular.Cantidad).label("total"),
        )
        .filter(models.TraficoVehicular.Departamento == depto)
        .group_by(models.TraficoVehicular.TipoVehiculo)
        .all()
    )

    datos = {"CARRO": 0, "MOTO": 0, "CAMION": 0, "CAMIONETA": 0, "PICKUP": 0}
    for tipo, total in filas:
        if tipo in datos:
            datos[tipo] = int(total)

    return {
        "departamento": depto,
        "carros":     datos["CARRO"],
        "motos":      datos["MOTO"],
        "camiones":   datos["CAMION"],
        "camionetas": datos["CAMIONETA"],
        "pickups":    datos["PICKUP"],
        "total":      sum(datos.values()),
    }


@app.get("/api/conteo/{departamento}")
def get_conteo(departamento: str, db: Session = Depends(get_db)):
    """Alias de /api/vehicular para compatibilidad con el frontend existente."""
    depto = limpiar_texto(departamento)

    filas = (
        db.query(
            models.TraficoVehicular.TipoVehiculo,
            sqlfunc.sum(models.TraficoVehicular.Cantidad).label("total"),
        )
        .filter(models.TraficoVehicular.Departamento == depto)
        .group_by(models.TraficoVehicular.TipoVehiculo)
        .all()
    )

    datos = {"CARRO": 0, "MOTO": 0, "CAMION": 0, "CAMIONETA": 0, "PICKUP": 0}
    for tipo, total in filas:
        if tipo in datos:
            datos[tipo] = int(total)

    return {
        "departamento": depto,
        "carros":     datos["CARRO"],
        "motos":      datos["MOTO"],
        "camiones":   datos["CAMION"],
        "camionetas": datos["CAMIONETA"],
        "pickups":    datos["PICKUP"],
    }