// frontend/src/pages/RegisterProvider.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerProvider } from '../services/authService';


function RegisterProvider() {
    const [formData, setFormData] = useState({
        nombre_comercial: '',
        cif: '',
        tipo_empresa: '',
        direccion_fiscal: '',
        web: '',
        bio: '',
        idiomas_hablados: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        telefono_contacto: '',
        email_contacto: ''
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

        if (formData.password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            // Preparamos los datos para la API
            const apiData = {
                ...formData,
                // Si el campo de idiomas se envía como string, lo convertimos a array
                idiomas_hablados: formData.idiomas_hablados.split(',').map(lang => lang.trim()).filter(Boolean)
            };

            const data = await registerProvider(apiData);
            setMessage(data.msg || "¡Proveedor registrado con éxito! Por favor, inicia sesión.");
            
            setTimeout(() => {
                navigate('/login');
            }, 2500);

        } catch (err) {
            setError(err.message || "Ocurrió un error durante el registro.");
        }
    };

    return (
        // Usamos la misma estructura que en Login para consistencia
        <div className="login-container register-provider-container">
            <main className="login-box">
                <header className="login-header">
                    <h1>Registro para Proveedores</h1>
                    <p>Crea tu perfil y empieza a gestionar tus citas</p>
                </header>

                <form onSubmit={handleSubmit} className="provider-form">
                    {/* --- SECCIÓN 1: DATOS DEL NEGOCIO --- */}
                    <fieldset>
                        <legend>Datos del Negocio</legend>
                        <input type="text" name="nombre_comercial" placeholder="Nombre Comercial" value={formData.nombre_comercial} onChange={handleChange} required />
                        <div className="form-row">
                            <input type="text" name="cif" placeholder="CIF / NIF" value={formData.cif} onChange={handleChange} required />
                            <input type="text" name="tipo_empresa" placeholder="Tipo de Empresa (Ej: Peluquería)" value={formData.tipo_empresa} onChange={handleChange} />
                        </div>
                        <div className="form-field-full-width">
                        <input type="text" name="direccion_fiscal" placeholder="Dirección Fiscal Completa" value={formData.direccion_fiscal} onChange={handleChange} />
                        </div>
                        <input type="url" name="web" placeholder="Página Web (https://ejemplo.com)" value={formData.web} onChange={handleChange} />
                        <div className="form-field-full-width">
                        <textarea name="bio" placeholder="Biografía o Descripción del Negocio" value={formData.bio} onChange={handleChange} rows="3"></textarea>
                        </div>
                        <input type="text" name="idiomas_hablados" placeholder="Idiomas hablados (separados por comas)" value={formData.idiomas_hablados} onChange={handleChange} />
                    </fieldset>

                    {/* --- SECCIÓN 2: DATOS DE CONTACTO Y CUENTA --- */}
                    <fieldset>
                        <legend>Datos de Contacto y Cuenta</legend>
                        <input type="email" name="email" placeholder="Email de Acceso (Login)" value={formData.email} onChange={handleChange} required />
                        <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} required />
                        <div className="form-row">
                            <input type="text" name="first_name" placeholder="Nombre (Persona de contacto)" value={formData.first_name} onChange={handleChange} required />
                            <input type="text" name="last_name" placeholder="Apellidos (Persona de contacto)" value={formData.last_name} onChange={handleChange} />
                        </div>
                        <div className="form-row">
                            <input type="tel" name="telefono_contacto" placeholder="Teléfono de Contacto Público" value={formData.telefono_contacto} onChange={handleChange} />
                            <input type="email" name="email_contacto" placeholder="Email de Contacto Público" value={formData.email_contacto} onChange={handleChange} />
                        </div>
                    </fieldset>

                    <button type="submit">Crear Cuenta de Proveedor</button>
                </form>

                {message && <p className="login-message" style={{ color: '#10b981' }}>{message}</p>}
                {error && <p className="error-message">{error}</p>}

                <footer className="login-footer">
                    <p>¿Ya eres proveedor? <Link to="/login">Inicia sesión</Link></p>
                </footer>
            </main>
        </div>
    );
}

export default RegisterProvider;