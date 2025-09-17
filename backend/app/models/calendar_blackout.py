from app import db

class CalendarBlackout(db.Model):
    __tablename__ = "calendar_blackouts"

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(db.Integer, db.ForeignKey("establishments.id"), nullable=False, index=True)

    # Día completo o franja parcial
    fecha = db.Column(db.Date, nullable=False, index=True)
    es_dia_completo = db.Column(db.Boolean, nullable=False, server_default=db.text("TRUE"))

    # Solo requeridas si es_dia_completo = False
    hora_inicio = db.Column(db.Time, nullable=True)
    hora_fin    = db.Column(db.Time, nullable=True)

    # Etiquetas opcionales
    nombre    = db.Column(db.String(120), nullable=True)   # p.ej. "Día de la Comunitat Valenciana"
    categoria = db.Column(db.String(50),  nullable=True)   # p.ej. "holiday", "feria", "mantenimiento"

    __table_args__ = (
        # Evita duplicar un día completo bloqueado en el mismo establecimiento.
        db.UniqueConstraint("establishment_id", "fecha", "es_dia_completo", name="uq_blackout_full_day"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "establishment_id": self.establishment_id,
            "date": self.fecha.isoformat(),
            "is_full_day": bool(self.es_dia_completo),
            "start_time": self.hora_inicio.isoformat() if self.hora_inicio else None,
            "end_time": self.hora_fin.isoformat() if self.hora_fin else None,
            "name": self.nombre,
            "category": self.categoria,
        }
