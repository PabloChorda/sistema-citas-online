// frontend/src/pages/RegisterProvider.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerProvider } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

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
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setIsSubmitting(true);
        try {
            const apiData = {
                ...formData,
                idiomas_hablados: formData.idiomas_hablados.split(',').map(lang => lang.trim()).filter(Boolean)
            };

            const data = await registerProvider(apiData);
            toast.success(data.msg || "¡Proveedor registrado! Revisa tu email para validar la cuenta.");
            
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err) {
            toast.error(err.message || "Ocurrió un error durante el registro.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container register-provider-container">
            <main className="login-box">
                <header className="login-header">
                    <h1>Registro para Proveedores</h1>
                    <p>Crea tu perfil y empieza a gestionar tus citas</p>
                </header>

                <form onSubmit={handleSubmit} className="provider-form">
                    <fieldset>
                        <legend>Datos del Negocio</legend>
                        <Input type="text" name="nombre_comercial" placeholder="Nombre Comercial" value={formData.nombre_comercial} onChange={handleChange} required />
                        <div className="form-row">
                            <Input type="text" name="cif" placeholder="CIF / NIF" value={formData.cif} onChange={handleChange} required />
                            <Input type="text" name="tipo_empresa" placeholder="Tipo de Empresa (Ej: Peluquería)" value={formData.tipo_empresa} onChange={handleChange} />
                        </div>
                        <div className="form-field-full-width">
                            <Input type="text" name="direccion_fiscal" placeholder="Dirección Fiscal Completa" value={formData.direccion_fiscal} onChange={handleChange} />
                        </div>
                        <Input type="url" name="web" placeholder="Página Web (https://ejemplo.com)" value={formData.web} onChange={handleChange} />
                        <div className="form-field-full-width">
                            <textarea name="bio" placeholder="Biografía o Descripción del Negocio" value={formData.bio} onChange={handleChange} rows="3" className="form-input"></textarea>
                        </div>
                        <Input type="text" name="idiomas_hablados" placeholder="Idiomas hablados (separados por comas)" value={formData.idiomas_hablados} onChange={handleChange} />
                    </fieldset>

                    <fieldset>
                        <legend>Datos de Contacto y Cuenta</legend>
                        <Input type="email" name="email" placeholder="Email de Acceso (Login)" value={formData.email} onChange={handleChange} required />
                        <Input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} required />
                        <div className="form-row">
                            <Input type="text" name="first_name" placeholder="Nombre (Persona de contacto)" value={formData.first_name} onChange={handleChange} required />
                            <Input type="text" name="last_name" placeholder="Apellidos (Persona de contacto)" value={formData.last_name} onChange={handleChange} />
                        </div>
                        <div className="form-row">
                            <Input type="tel" name="telefono_contacto" placeholder="Teléfono de Contacto Público" value={formData.telefono_contacto} onChange={handleChange} />
                            <Input type="email" name="email_contacto" placeholder="Email de Contacto Público" value={formData.email_contacto} onChange={handleChange} />
                        </div>
                    </fieldset>

                    <Button type="submit" variant="primary" disabled={isSubmitting}>
                        {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta de Proveedor'}
                    </Button>
                </form>

                <footer className="login-footer">
                    <p>¿Ya eres proveedor? <Link to="/login">Inicia sesión</Link></p>
                </footer>
            </main>
        </div>
    );
}

export default RegisterProvider;