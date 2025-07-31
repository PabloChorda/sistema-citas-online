// frontend/src/pages/Register.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService'; // Asegúrate de que esta función exista en authService.js


function Register() {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone_number: ''
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        // Validación simple de contraseña
        if (formData.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            const data = await registerUser(formData);
            setMessage(data.msg || "¡Registro exitoso! Por favor, inicia sesión.");
            // Pequeña pausa para que el usuario pueda leer el mensaje antes de redirigir
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.message || "Ocurrió un error durante el registro.");
        }
    };

    return (
        <div className="login-container"> {/* Usamos la clase contenedora principal de Login */}
            <main className="login-box"> {/* Usamos la clase para la caja central */}
                <header className="login-header"> {/* Encabezado morado */}
                    <h1>Crear Cuenta de Cliente</h1>
                    <p>Únete para empezar a reservar tus citas</p>
                </header>
                
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        name="first_name"
                        placeholder="Nombre"
                        value={formData.first_name}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="last_name"
                        placeholder="Apellidos"
                        value={formData.last_name}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="Contraseña"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="tel"
                        name="phone_number"
                        placeholder="Teléfono (Opcional)"
                        value={formData.phone_number}
                        onChange={handleChange}
                    />
                    
                    <button type="submit">Registrarse</button>
                </form>

                {message && <p className="login-message" style={{ color: '#28a745' }}>{message}</p>}
                {error && <p className="login-message" style={{ color: '#dc3545' }}>{error}</p>}

                <footer className="login-footer">
                    <p>¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link></p>
                </footer>
            </main>
        </div>
    );
}

export default Register;