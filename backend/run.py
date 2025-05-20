# backend/run.py
import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash # Para contraseñas

# Configuración básica
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'instance', 'site.sqlite3')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Crear la carpeta 'instance' si no existe
instance_path = os.path.join(basedir, 'instance')
if not os.path.exists(instance_path):
    os.makedirs(instance_path)

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# --- Modelos ---
# Usuarios (tanto clientes como proveedores)
class User(db.Model):
    __tablename__ = 'users'
    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    phone_number = db.Column(db.String(20))
    role = db.Column(db.String(10), nullable=False, default='client') # 'client', 'provider'
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    # Relación para el perfil de proveedor (si es un proveedor)
    provider_profile = db.relationship('Provider', backref='user', uselist=False, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.email}>'

# Perfiles de Proveedores
class Provider(db.Model):
    __tablename__ = 'providers'
    # provider_id es el mismo que user_id, pero lo definimos como FK
    provider_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True)
    business_name = db.Column(db.String(255), nullable=False)
    business_type = db.Column(db.String(100))
    address = db.Column(db.Text)
    bio = db.Column(db.Text)
    profile_picture_url = db.Column(db.String(255))
    timezone = db.Column(db.String(50), nullable=False, default='UTC')

    # Aquí podrías añadir relaciones a Servicios, Horarios, etc.

    def __repr__(self):
        return f'<Provider {self.business_name}>'

# --- Rutas API ---
@app.route('/')
def home():
    return "Hola desde el Backend de Flask con DB!"

@app.route('/api/test-db')
def api_test_db():
    try:
        # Intenta hacer una consulta simple para verificar la conexión
        user_count = User.query.count()
        return jsonify({"message": "Conexión a DB exitosa!", "user_count": user_count})
    except Exception as e:
        return jsonify({"message": "Error conectando a DB", "error": str(e)}), 500

@app.route('/api/register/provider', methods=['POST'])
def register_provider():
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password') or not data.get('business_name'):
        return jsonify({"error": "Faltan datos requeridos: email, password, business_name"}), 400

    email = data.get('email')
    password = data.get('password')
    business_name = data.get('business_name')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    phone_number = data.get('phone_number')
    business_type = data.get('business_type', 'default') # Asignar un valor por defecto si no se proporciona
    timezone = data.get('timezone', 'UTC')

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "El email ya está registrado"}), 409 # Conflict

    new_user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        role='provider'
    )
    new_user.set_password(password)

    new_provider_profile = Provider(
        user=new_user, # Asocia con el objeto User
        business_name=business_name,
        business_type=business_type,
        timezone=timezone
    )

    try:
        db.session.add(new_user)
        # new_provider_profile se añade implícitamente por la relación y cascade
        db.session.commit()
        return jsonify({
            "message": "Proveedor registrado exitosamente!",
            "user_id": new_user.user_id,
            "email": new_user.email,
            "business_name": new_provider_profile.business_name
        }), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error al registrar proveedor: {e}")
        return jsonify({"error": "Error interno del servidor al registrar el proveedor"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)