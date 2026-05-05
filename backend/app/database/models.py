from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .conexion import Base # Importamos la base que definiremos en database.py


class TraficoVehicular(Base):
    """Tabla que almacena el conteo de vehículos por tipo y departamento.
    Reemplaza la lectura de vehicular_febrero.txt con pandas."""
    __tablename__ = "TraficoVehicular"

    Id           = Column(Integer, primary_key=True, index=True)
    Departamento = Column(String(100), nullable=False, index=True)
    TipoVehiculo = Column(String(50),  nullable=False)  # CARRO, MOTO, CAMION, CAMIONETA, PICKUP
    Cantidad     = Column(Integer, default=0)
    Mes          = Column(String(20), default='FEBRERO')


class Usuario(Base):
    __tablename__ = "Usuarios" 

    Id = Column(Integer, primary_key=True, index=True)
    Nombre = Column(String(100), nullable=False)
    Correo = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    FechaRegistro = Column(DateTime, server_default=func.now())
    # NUEVOS CAMPOS:
    CodigoRecuperacion = Column(String(6), nullable=True)
    FechaExpiracionCodigo = Column(DateTime, nullable=True)