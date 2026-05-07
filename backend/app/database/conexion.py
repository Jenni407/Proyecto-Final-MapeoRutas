import pyodbc
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Definimos la URL de conexión completa para SQLAlchemy
# Usamos el Driver 17 que confirmamos que tienes instalado
DATABASE_URL = "mssql+pyodbc://(local)\SQLEXPRESS/MapaRutas?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"

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

    