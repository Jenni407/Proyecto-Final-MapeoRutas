import os
import unicodedata
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from datetime import datetime
from fastapi.responses import FileResponse
import random
from sqlalchemy.orm import Session
import bcrypt
# Importaciones para la base de datos
from app.database import models, schemas
from app.database.conexion import SessionLocal, engine, get_db
# Crea las tablas si no existen (aunque ya las creaste en SSMS, esto ayuda) 
models.Base.metadata.create_all(bind=engine)
from enviocorreo import enviar_correo_verificacion 

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

@app.post("/api/registrar", response_model=schemas.UsuarioResponse)
def registrar_usuario(usuario: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    # Verificar si el correo ya existe
    db_usuario = db.query(models.Usuario).filter(models.Usuario.Correo == usuario.Correo).first()
    if db_usuario:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Encriptar contraseña para el campo password_hash de tu tabla
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
    # Buscamos en SQL Server Management Studio
    user = db.query(models.Usuario).filter(models.Usuario.Nombre == datos.Nombre).first()
    
    if not user or not bcrypt.checkpw(datos.Password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Si todo es correcto, generas el código 
    codigo = str(random.randint(100000, 999999))
    codigos_2fa[user.Nombre] = codigo # Usamos el nombre que viene de la BD
    
    # aquí envias el código. 
    if user.Correo:  # Verificamos que el correo no sea None o vacío
        enviado = enviar_correo_verificacion(user.Correo, user.Nombre, codigo)
        if enviado:
            print(f"correo enviado a {user.Correo} con el código: {codigo}")
        else:
            print("Falló el envío del correo.")
    else:
        print(f"El usuario {user.Nombre} no tiene correo registrado en la DB.")

    # Mantenemos el print en consola por si necesitas debuguear rápido
    print(f"\n*** CODIGO DE SEGURIDAD ***\nCódigo para {user.Nombre}: {codigo}\n**********************\n")
    
    return {"status": "success", "mensaje": "Código enviado al correo", "usuario": user.Nombre}

# duncion para limpiar el texto de entrada y evitar problemas con acentos, mayúsculas, etc.
def limpiar_texto(texto):
    if texto is None: return ""
    # Mantiene espacios, quita tildes, todo a mayúsculas
    texto = str(texto).upper().strip()
    return ''.join(c for c in unicodedata.normalize('NFD', texto)
                  if unicodedata.category(c) != 'Mn')

# CARGA DEL ARCHIVO
print("Cargando archivo SAT...")
try:
    df_sat = pd.read_csv('app/data/vehicular_febrero.txt', sep='|', encoding='latin-1', low_memory=False)
    df_sat.columns = df_sat.columns.str.strip()
    df_sat['CANTIDAD'] = pd.to_numeric(df_sat['CANTIDAD'], errors='coerce').fillna(0)
    
    # CREAMOS LA COLUMNA AUXILIAR UNA SOLA VEZ
    df_sat['DE_LIMPIO'] = df_sat['NOMBRE_DEPARTAMENTO'].apply(limpiar_texto)
    
    # LLENAMOS LOS DICCIONARIOS (RAM)
    totales_por_depto = df_sat.groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    
    motos_mask = df_sat['TIPO_VEHICULO'].str.contains('MOTO', na=False, case=False)
    motos_por_depto = df_sat[motos_mask].groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    
    carros_mask = df_sat['TIPO_VEHICULO'].str.contains('PARTICULAR|AUTOMOVIL', na=False, case=False)
    carros_por_depto = df_sat[carros_mask].groupby('DE_LIMPIO')['CANTIDAD'].sum().to_dict()
    
    print("Datos cargados.")
except Exception as e:
    print(f"ERROR CRÍTICO: {e}")

def precargar_datos():
    global totales_por_depto
    print("Precargando datos de la SAT para mayor velocidad...")
    # Agrupamos por departamento y sumamos una sola vez
    resumen = df_sat.groupby('NOMBRE_DEPARTAMENTO')['CANTIDAD'].sum()
    totales_por_depto = resumen.to_dict()
    print("¡Datos listos en memoria!")

# Llama a esta función después de cargar el df_sat
precargar_datos()

# CONSULTA ( NOMBRE_DEPARTAMENTO y CANTIDAD)
@app.get("/api/consultar/{departamento}")
def consultar_trafico(departamento: str, usuario: str, codigo_ingresado: str):
    # Validar 2FA
    if codigos_2fa.get(usuario) != codigo_ingresado.strip():
        raise HTTPException(status_code=403, detail="Código 2FA inválido")
    
    if df_sat.empty:
        raise HTTPException(status_code=500, detail="Archivo no cargado")

    depto_buscado = limpiar_texto(departamento)
    
 # BUSQUEDA ULTRA RÁPIDA: Ya no filtra el DataFrame, solo mira el diccionario
    total_base = totales_por_depto.get(depto_buscado, 0)
    
    if total_base == 0:
        return {"error": "Sin datos", "sugerencias": ["GUATEMALA", "SACATEPEQUEZ", "ESCUINTLA"]}
    
    # CAPTURAMOS LA HORA 
    ahora = datetime.now()
    hora_actual = ahora.hour
    minutos_actual = ahora.strftime("%M")
    
    # LÓGICA DE TRÁFICO POR HORA 
    if (7 <= hora_actual <= 9) or (17 <= hora_actual <= 19):
        factor_trafico = random.uniform(0.15, 0.25) # 25% del total
        estado = "HORA PICO - Tráfico Pesado"
    elif (22 <= hora_actual) or (hora_actual <= 5):
        factor_trafico = random.uniform(0.01, 0.03) # 3% del total
        estado = "Fluidez Alta - Madrugada"
    else:
        factor_trafico = random.uniform(0.05, 0.10) # 10% del total
        estado = "Tráfico Moderado"

    vehiculos_en_ruta = int(total_base * factor_trafico)

    return {
        "departamento": depto_buscado,
        "hora_de_consulta": f"{hora_actual}:{minutos_actual}",
        "estado_del_vial": estado,
        "vehiculos_detectados_ahora": vehiculos_en_ruta,
        "total_historico_mes": total_base,
    }

def precargar_vehiculos():
    global motos_por_depto, carros_por_depto
    print("Optimizando conteo de vehículos...")
    
    # Filtramos una sola vez al iniciar el servidor
    df_motos = df_sat[df_sat['TIPO_VEHICULO'].str.contains('MOTO', na=False, case=False)]
    df_carros = df_sat[df_sat['TIPO_VEHICULO'].str.contains('PARTICULAR|AUTOMOVIL', na=False, case=False)]
    
    motos_por_depto = df_motos.groupby('NOMBRE_DEPARTAMENTO')['CANTIDAD'].sum().to_dict()
    carros_por_depto = df_carros.groupby('NOMBRE_DEPARTAMENTO')['CANTIDAD'].sum().to_dict()

    precargar_datos()  # Aseguramos que totales_por_departamento también esté listo
    print("¡Conteos precargados!")

@app.get("/api/conteo/{departamento}")
async def get_conteo(departamento: str):
    depto_buscado = limpiar_texto(departamento)
    
    return {
        "departamento": depto_buscado,
        "carros": int(carros_por_depto.get(depto_buscado, 0)),
        "motos": int(motos_por_depto.get(depto_buscado, 0))
    }