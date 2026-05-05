import pyodbc
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import urllib.parse

# 1. Definimos la URL de conexión completa para SQLAlchemy
# Usamos el Driver 17 que confirmamos que tienes instalado
connection_string = (
    "Driver={ODBC Driver 17 for SQL Server};"
    "Server=localhost;"              # Cambiado a localhost según tu imagen
    "Database=MapaRutas;"            # Asegúrate que este nombre sea exacto en SSMS
    "Trusted_Connection=yes;"        # Autenticación de Windows
    "Encrypt=yes;"                   # Corresponde a 'Cifrar: Obligatorio'
    "TrustServerCertificate=yes;"    # Corresponde al check de 'Certificado de confianza'
)

# Codificamos los parámetros para la URL
params = urllib.parse.quote_plus(connection_string)
DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"

# 2. Creamos el engine con la URL
# El argumento 'fast_executemany' acelera las inserciones en SQL Server
engine = create_engine(DATABASE_URL, fast_executemany=True)

# 3. Configuramos la sesión y la base decorativa
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# 4. Función para obtener la sesión de la BD (Dependency Injection)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 5. Mantener tu función original por si usas pyodbc directo en algún script
def obtener_conexion():
    conn_str = (
        "Driver={ODBC Driver 17 for SQL Server};"
        "Server=.;"
        "Database=MapaRutas;"
        "Trusted_Connection=yes;"
    )
    return pyodbc.connect(conn_str)

    