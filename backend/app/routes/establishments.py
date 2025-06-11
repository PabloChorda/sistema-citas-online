# backend/app/routes/establishments.py

from flask import Blueprint, request, jsonify, current_app
from app import db
from app.models import Establishment
from sqlalchemy.exc import IntegrityError
from flask_cors import cross_origin

bp = Blueprint('establishments', __name__, url_prefix='/establishments')


@bp.route('/', methods=['GET'])
def get_establishments():
    provider_id = request.args.get('provider_id', type=int)
    query = Establishment.query

    if provider_id:
        query = query.filter_by(provider_id=provider_id)

    establishments = query.all()
    return jsonify([serialize_establishment(e) for e in establishments]), 200


@bp.route('/<int:id>', methods=['GET'])
def get_establishment(id):
    est = Establishment.query.get_or_404(id)
    return jsonify(serialize_establishment(est)), 200


@bp.route('/', methods=['POST'])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def create_establishment():
    try:
        data = request.get_json()

        required_fields = ['nombre', 'direccion_completa', 'provincia', 'localidad', 'provider_id']
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            return jsonify({"msg": f"Campos obligatorios faltantes: {', '.join(missing)}"}), 400

        est = Establishment(
            provider_id=data['provider_id'],
            nombre=data['nombre'],
            direccion_completa=data['direccion_completa'],
            provincia=data['provincia'],
            localidad=data['localidad'],
            codigo_postal=data.get('codigo_postal'),
            telefono=data.get('telefono'),
            email=data.get('email'),
            web=data.get('web'),
            abre_sabados=data.get('abre_sabados'),
            cierra_sabado=data.get('cierra_sabado'),
            visible_en_busquedas=data.get('visible_en_busquedas', True),
            verificado=data.get('verificado'),
            activo=data.get('activo', True),
            descripcion_publica=data.get('descripcion_publica'),
            slug=data.get('slug'),
            imagen_destacada=data.get('imagen_destacada'),
            url_map_embed=data.get('url_map_embed'),
            tiene_acceso_discapacitados=data.get('tiene_acceso_discapacitados'),
            aparcamiento_disponible=data.get('aparcamiento_disponible'),
            idiomas_hablados=data.get('idiomas_hablados'),
            horario_lunes_viernes=data.get('horario_lunes_viernes'),
            horario_sabado=data.get('horario_sabado')
        )

        db.session.add(est)
        db.session.commit()
        return jsonify(serialize_establishment(est)), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"msg": "Error de integridad en la base de datos", "error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creando establecimiento: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error": str(e)}), 500


@bp.route('/<int:id>', methods=['PUT'])
def update_establishment(id):
    est = Establishment.query.get_or_404(id)
    data = request.get_json()

    try:
        for key, value in data.items():
            if hasattr(est, key):
                setattr(est, key, value)

        db.session.commit()
        return jsonify(serialize_establishment(est)), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error actualizando establecimiento: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error": str(e)}), 500


@bp.route('/<int:id>', methods=['DELETE'])
def delete_establishment(id):
    est = Establishment.query.get_or_404(id)

    try:
        db.session.delete(est)
        db.session.commit()
        return jsonify({"msg": "Establecimiento eliminado correctamente"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error eliminando establecimiento: {e}", exc_info=True)
        return jsonify({"msg": "Error interno del servidor", "error": str(e)}), 500


def serialize_establishment(est):
    return {
        "id": est.id,
        "provider_id": est.provider_id,
        "nombre": est.nombre,
        "direccion_completa": est.direccion_completa,
        "codigo_postal": est.codigo_postal,
        "provincia": est.provincia,
        "localidad": est.localidad,
        "telefono": est.telefono,
        "email": est.email,
        "web": est.web,
        "abre_sabados": est.abre_sabados,
        "cierra_sabado": est.cierra_sabado,
        "visible_en_busquedas": est.visible_en_busquedas,
        "verificado": est.verificado,
        "activo": est.activo,
        "descripcion_publica": est.descripcion_publica,
        "slug": est.slug,
        "imagen_destacada": est.imagen_destacada,
        "url_map_embed": est.url_map_embed,
        "tiene_acceso_discapacitados": est.tiene_acceso_discapacitados,
        "aparcamiento_disponible": est.aparcamiento_disponible,
        "idiomas_hablados": est.idiomas_hablados,
        "horario_lunes_viernes": est.horario_lunes_viernes,
        "horario_sabado": est.horario_sabado,
        "created_at": est.created_at.isoformat() if est.created_at else None,
        "updated_at": est.updated_at.isoformat() if est.updated_at else None,
    }
