"""Base de datos: exporta la base declarativa y utilidades de sesion.

No se importa `app.db.session` aqui para evitar crear el engine (y requerir el
driver async) al importar solo los modelos. Los consumidores que necesiten la
sesion la importan de `app.db.session`.
"""
from app.db.base import Base, TimestampMixin, UUIDPkMixin, utcnow

__all__ = ["Base", "TimestampMixin", "UUIDPkMixin", "utcnow"]
