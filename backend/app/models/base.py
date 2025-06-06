# backend/app/models/base.py
"""
Clase base común para modelos con campos y métodos compartidos.
"""
from sqlalchemy.sql import func
from .. import db

class TimestampMixin:
    """Mixin que añade campos de timestamp a los modelos."""
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class BaseModel(db.Model, TimestampMixin):
    """Clase base abstracta para todos los modelos."""
    __abstract__ = True
    
    def to_dict_base(self):
        """Método base para convertir timestamps a dict."""
        return {
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }