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
      
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
                <legend className="text-lg font-semibold text-gray-700 mb-2">Datos del Negocio</legend>
      
                <Input type="text" name="nombre_comercial" placeholder="Nombre Comercial" value={formData.nombre_comercial} onChange={handleChange} required />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input type="text" name="cif" placeholder="CIF / NIF" value={formData.cif} onChange={handleChange} required />
                  <Input type="text" name="tipo_empresa" placeholder="Tipo de Empresa (Ej: Peluquería)" value={formData.tipo_empresa} onChange={handleChange} />
                </div>
      
                <Input type="text" name="direccion_fiscal" placeholder="Dirección Fiscal Completa" value={formData.direccion_fiscal} onChange={handleChange} />
                <Input type="url" name="web" placeholder="Página Web (https://ejemplo.com)" value={formData.web} onChange={handleChange} />
                
                <textarea name="bio" placeholder="Biografía o Descripción del Negocio" value={formData.bio} onChange={handleChange} rows="3" className="form-input" />
                <Input type="text" name="idiomas_hablados" placeholder="Idiomas hablados (separados por comas)" value={formData.idiomas_hablados} onChange={handleChange} />
              </fieldset>
      
              <fieldset className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
                <legend className="text-lg font-semibold text-gray-700 mb-2">Datos de Contacto y Cuenta</legend>
      
                <Input type="email" name="email" placeholder="Email de Acceso (Login)" value={formData.email} onChange={handleChange} required />
                <Input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} required />
      
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input type="text" name="first_name" placeholder="Nombre (Persona de contacto)" value={formData.first_name} onChange={handleChange} required />
                  <Input type="text" name="last_name" placeholder="Apellidos (Persona de contacto)" value={formData.last_name} onChange={handleChange} />
                </div>
      
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input type="tel" name="telefono_contacto" placeholder="Teléfono de Contacto Público" value={formData.telefono_contacto} onChange={handleChange} />
                  <Input type="email" name="email_contacto" placeholder="Email de Contacto Público" value={formData.email_contacto} onChange={handleChange} />
                </div>
              </fieldset>
      
              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta de Proveedor'}
                </Button>
              </div>
            </form>
      
            <footer className="login-footer">
              <p>¿Ya eres proveedor? <Link to="/login">Inicia sesión</Link></p>
            </footer>
          </main>
        </div>
      );
}

export default RegisterProvider;