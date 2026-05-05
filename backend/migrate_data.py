# -*- coding: utf-8 -*-
"""
migrate_data.py  -  Ejecutar UNA SOLA VEZ desde la carpeta backend:
    python migrate_data.py

Lee vehicular_febrero.txt línea por línea (sin pandas) y guarda los
totales por departamento y tipo de vehículo en SQL Server.
"""
import csv
import unicodedata
import sys
import os

# Forzar salida UTF-8 en Windows para evitar errores de codificacion
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Asegurar que el modulo app este en el path
sys.path.insert(0, os.path.dirname(__file__))

from app.database.conexion import SessionLocal, engine
from app.database import models

# Crear la tabla si no existe
models.Base.metadata.create_all(bind=engine)


# ─── Helpers ────────────────────────────────────────────────────────────────

def limpiar_texto(texto: str) -> str:
    if not texto:
        return ""
    texto = str(texto).upper().strip()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def clasificar_vehiculo(tipo_raw: str) -> str:
    t = limpiar_texto(tipo_raw)
    if any(x in t for x in ["MOTO", "MOTOCICLETA"]):
        return "MOTO"
    if any(x in t for x in ["CAMION", "BUS", "AUTOBUS", "TRAILER"]):
        return "CAMION"
    if "CAMIONETA" in t:
        return "CAMIONETA"
    if "PICKUP" in t or "PICK UP" in t:
        return "PICKUP"
    # Carros, automóviles, particulares, sedán, etc.
    return "CARRO"


# ─── Migración ──────────────────────────────────────────────────────────────

def migrar():
    archivo = os.path.join(os.path.dirname(__file__), "app", "data", "vehicular_febrero.txt")

    if not os.path.exists(archivo):
        print(f"ERROR: No se encontró el archivo {archivo}")
        return

    print("Leyendo vehicular_febrero.txt (esto puede tomar varios minutos)...")

    # Acumulador: { departamento: { tipo: cantidad } }
    acum: dict[str, dict[str, int]] = {}
    TIPOS = ["CARRO", "MOTO", "CAMION", "CAMIONETA", "PICKUP"]

    try:
        with open(archivo, encoding="latin-1", newline="") as f:
            reader = csv.DictReader(f, delimiter="|")
            for i, row in enumerate(reader):
                depto = limpiar_texto(row.get("NOMBRE_DEPARTAMENTO", ""))
                tipo  = clasificar_vehiculo(row.get("TIPO_VEHICULO", ""))
                try:
                    cantidad = int(float(row.get("CANTIDAD", 0) or 0))
                except (ValueError, TypeError):
                    cantidad = 0

                if depto not in acum:
                    acum[depto] = {t: 0 for t in TIPOS}
                acum[depto][tipo] += cantidad

                if i % 200_000 == 0 and i > 0:
                    print(f"  >> {i:,} filas procesadas - {len(acum)} departamentos encontrados")

    except Exception as exc:
        print(f"Error leyendo el archivo: {exc}")
        return

    print(f"\nTotal filas leidas. Departamentos encontrados: {len(acum)}")
    print("Insertando en SQL Server...")

    db = SessionLocal()
    try:
        # Borra datos anteriores para evitar duplicados
        db.query(models.TraficoVehicular).delete()
        db.commit()

        registros = []
        for depto, tipos in acum.items():
            if not depto:
                continue
            for tipo, cantidad in tipos.items():
                registros.append(
                    models.TraficoVehicular(
                        Departamento=depto,
                        TipoVehiculo=tipo,
                        Cantidad=cantidad,
                        Mes="FEBRERO",
                    )
                )

        db.bulk_save_objects(registros)
        db.commit()
        print(f"[OK] Migracion completa. {len(registros)} registros insertados en TraficoVehicular.")

    except Exception as exc:
        db.rollback()
        print(f"Error insertando en BD: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    migrar()
