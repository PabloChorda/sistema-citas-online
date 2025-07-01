# backend/app/models/tag.py
"""
Modelos para Tags (etiquetas) y su asociación con los Establecimientos.
"""
from .. import db
from .base import BaseModel
from sqlalchemy.orm import validates

class Tag(BaseModel):
    __tablename__ = 'tags'
    __table_args__ = (
        db.UniqueConstraint('nombre', 'tipo', name='uix_nombre_tipo'),
    )

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), nullable=True)
    icono = db.Column(db.String(100), nullable=True)
    activo = db.Column(db.Boolean, default=True, nullable=False)

    # Relación
    establishments = db.relationship('Establishment', secondary='establecimiento_tags', back_populates='tags')

    @validates('color')
    def validate_color(self, key, value):
        if value and (not value.startswith('#') or len(value) != 7):
            raise ValueError("El color debe estar en formato hexadecimal, ej. #AABBCC.")
        return value

    def __repr__(self):
        return f'<Tag ID {self.id}: {self.nombre} ({self.tipo})>'

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'tipo': self.tipo,
            'color': self.color,
            'icono': self.icono,
            'activo': self.activo,
            **self.to_dict_base()
        }

class EstablishmentTag(BaseModel):
    __tablename__ = 'establecimiento_tags'

    id = db.Column(db.Integer, primary_key=True)
    establecimiento_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # La relación se maneja a través del parámetro 'secondary' en los modelos Tag y Establishment.
    # No son estrictamente necesarias relaciones aquí, pero se pueden añadir si se necesita.

    def __repr__(self):
        return f'<EstablishmentTag: Est. {self.establecimiento_id} <-> Tag {self.tag_id}>'