import os
import unicodedata
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from datetime import datetime, timedelta
from fastapi.responses import FileResponse
import random
from sqlalchemy.orm import Session
import bcrypt
from jose import JWTError, jwt
from app.database import models, schemas
from app.database.conexion import SessionLocal, engine, get_db
models.Base.metadata.create_all(bind=engine)
from enviocorreo import enviar_correo_verificacion
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


def limpiar_texto(texto):
    if texto is None:
        return ""
    texto = str(texto).upper().strip()
    return ''.join(
        c for c in unicodedata.normalize('NFD', texto)
        if unicodedata.category(c) != 'Mn'
    )

security = HTTPBearer()
app = FastAPI()
codigos_2fa = {}
df_sat = pd.DataFrame()
totales_por_depto = {}
motos_por_depto = {}
carros_por_depto = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración JWT
SECRET_KEY = "mapeo_rutas_26/dkjske"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Endpoints de registro y login
@app.post("/api/registrar", response_model=schemas.UsuarioResponse)
def registrar_usuario(usuario: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.Correo == usuario.Correo).first()
    if db_usuario:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    hashed_pw = bcrypt.hashpw(usuario.Password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    nuevo_usuario = models.Usuario(
        Nombre=usuario.Nombre,
        Correo=usuario.Correo,
        password_hash=hashed_pw
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.post("/api/login")
def login(datos: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.Nombre == datos.Nombre).first()
    if not user or not bcrypt.checkpw(datos.Password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Generar código 2FA
    codigo = str(random.randint(100000, 999999))
    codigos_2fa[user.Nombre] = codigo

    # Enviar correo
    if user.Correo:
        enviado = enviar_correo_verificacion(user.Correo, user.Nombre, codigo)
        if enviado:
            print(f"Correo enviado a {user.Correo} con código: {codigo}")
        else:
            print("Falló el envío del correo.")
    else:
        print(f"El usuario {user.Nombre} no tiene correo registrado.")

    print(f"\n*** SEGURIDAD ***\nCódigo para {user.Nombre}: {codigo}\n*****************\n")
    
  
    token = create_access_token({"sub": user.Nombre, "codigo_2fa": codigo})
    return {
        "status": "success",
        "mensaje": "Código enviado al correo",
        "usuario": user.Nombre,
        "token": token  
    }

@app.post("/api/reset-password")
def reset_password(datos: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(
        models.Usuario.Correo == datos.Correo,
        models.Usuario.CodigoRecuperacion == datos.Codigo
    ).first()
    if not user or datetime.now() > user.FechaExpiracionCodigo:
        raise HTTPException(status_code=400, detail="Código inválido o expirado")
    hashed_pw = bcrypt.hashpw(datos.NuevaPassword.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user.password_hash = hashed_pw
    user.CodigoRecuperacion = None
    user.FechaExpiracionCodigo = None
    db.commit()
    return {"status": "success", "mensaje": "Contraseña actualizada correctamente"}

# Carga de datos históricos
print("Cargando los datos, por favor espera...")
try:
    df_sat = pd.read_csv('app/data/vehicular_febrero.txt', sep='|', encoding='latin-1', low_memory=False)
    df_sat.columns = df_sat.columns.str.strip()
    df_sat['CANTIDAD'] = pd.to_numeric(df_sat['CANTIDAD'], errors='coerce').fillna(0)
    df_sat['DE_LIMPIO'] = df_sat['NOMBRE_DEPARTAMENTO'].apply(limpiar_texto)
    totales_por_depto = df_sat.groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    motos_mask = df_sat['TIPO_VEHICULO'].str.contains('MOTO', na=False, case=False)
    motos_por_depto = df_sat[motos_mask].groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    carros_mask = df_sat['TIPO_VEHICULO'].str.contains('PARTICULAR|AUTOMOVIL', na=False, case=False)
    carros_por_depto = df_sat[carros_mask].groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    print("Datos cargados.")
except Exception as e:
    print(f"ERROR CRÍTICO: {e}")

# Endpoint de consulta de tráfico (datos quemados, funcional)
@app.get("/api/consultar/{departamento}")
def consultar_trafico(
    departamento: str,
    usuario: str,
    codigo_ingresado: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Validar JWT y código 2FA
    try:
    
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_from_token = payload.get("sub")
        codigo_from_token = payload.get("codigo_2fa")
    except JWTError:
        raise HTTPException(status_code=403, detail="Token inválido")
    
    if user_from_token != usuario:
        raise HTTPException(status_code=403, detail="Usuario no coincide")
    
    codigo_almacenado = codigos_2fa.get(usuario)
    if codigo_almacenado != codigo_ingresado.strip():
        raise HTTPException(status_code=403, detail="Código 2FA inválido")

    depto_buscado = limpiar_texto(departamento)
    total_base = totales_por_depto.get(depto_buscado, 0)
    
    if total_base == 0:
        return {"error": "Sin datos", "sugerencias": ["GUATEMALA", "SACATEPEQUEZ", "ESCUINTLA"]}
    
    ahora = datetime.now()
    hora_actual = ahora.hour
    minutos_actual = ahora.strftime("%M")
    
    # Lógica de tráfico por hora
    if (7 <= hora_actual <= 9) or (17 <= hora_actual <= 19):
        factor_trafico = random.uniform(0.15, 0.25)
        estado = "HORA PICO - Tráfico Pesado"
    elif (22 <= hora_actual) or (hora_actual <= 5):
        factor_trafico = random.uniform(0.01, 0.03)
        estado = "Fluidez Alta - Madrugada"
    else:
        factor_trafico = random.uniform(0.05, 0.10)
        estado = "Tráfico Moderado"

    vehiculos_en_ruta = int(total_base * factor_trafico)
    return {
        "departamento": depto_buscado,
        "hora_de_consulta": f"{hora_actual}:{minutos_actual}",
        "estado_del_vial": estado,
        "vehiculos_detectados_ahora": vehiculos_en_ruta,
        "total_historico_mes": total_base,
    }

@app.get("/api/conteo/{departamento}")
async def get_conteo(departamento: str):
    depto_buscado = limpiar_texto(departamento)
    return {
        "departamento": depto_buscado,
        "carros": int(carros_por_depto.get(depto_buscado, 0)),
        "motos": int(motos_por_depto.get(depto_buscado, 0))
    }