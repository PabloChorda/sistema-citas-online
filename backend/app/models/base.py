# backend/app/models/base.py
"""
Define la BaseModel que incluye campos comunes como timestamps.
"""
from .. import db
from sqlalchemy.sql import func

class BaseModel(db.Model):
    """
    Clase base para todos los modelos que añade campos de auditoría.
    """
    __abstract__ = True  # Indica a SQLAlchemy que no cree una tabla para este modelo.

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict_base(self):
        """Convierte los campos base a diccionario."""
        return {
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }