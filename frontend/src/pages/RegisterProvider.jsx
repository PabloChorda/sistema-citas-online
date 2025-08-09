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

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiData = {
        ...formData,
        idiomas_hablados: formData.idiomas_hablados
          .split(',')
          .map(lang => lang.trim())
          .filter(Boolean)
      };

      const data = await registerProvider(apiData);
      toast.success(data.msg || '¡Proveedor registrado! Revisa tu email para validar la cuenta.');

      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      toast.error(err.message || 'Ocurrió un error durante el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="login-container register-provider-container">
        <header className="login-header">
          <h1>Registro para Proveedores</h1>
          <p>Crea tu perfil y empieza a gestionar tus citas</p>
        </header>

        <main className="login-box max-w-3xl w-full mx-auto p-8 rounded-lg shadow-lg bg-white">
          <form onSubmit={handleSubmit} className="space-y-8 text-left">
            {/* Datos del Negocio */}
            <fieldset className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
              <legend className="text-lg font-semibold text-gray-800">Datos del Negocio</legend>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Nombre comercial</span>
                <Input
                  type="text"
                  name="nombre_comercial"
                  placeholder="Ej: Estilo & Belleza"
                  value={formData.nombre_comercial}
                  onChange={handleChange}
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">CIF / NIF</span>
                  <Input
                    type="text"
                    name="cif"
                    placeholder="B12345678"
                    value={formData.cif}
                    onChange={handleChange}
                    required
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Tipo de empresa</span>
                  <Input
                    type="text"
                    name="tipo_empresa"
                    placeholder="Ej: Peluquería"
                    value={formData.tipo_empresa}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <Input
                type="text"
                name="direccion_fiscal"
                placeholder="Dirección fiscal"
                value={formData.direccion_fiscal}
                onChange={handleChange}
              />
              <Input
                type="url"
                name="web"
                placeholder="Página web (https://...)"
                value={formData.web}
                onChange={handleChange}
              />

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Biografía / Descripción</span>
                <textarea
                  name="bio"
                  rows={4}
                  placeholder="Describe tus servicios, especialidades y lo que te diferencia…"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
                />
              </label>

              <Input
                type="text"
                name="idiomas_hablados"
                placeholder="Idiomas hablados (separados por comas)"
                value={formData.idiomas_hablados}
                onChange={handleChange}
              />
            </fieldset>

            {/* Datos de Contacto */}
            <fieldset className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
              <legend className="text-lg font-semibold text-gray-800">Datos de Contacto y Cuenta</legend>

              <Input
                type="email"
                name="email"
                placeholder="Email de acceso"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Contraseña"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-600 hover:text-brand-700"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="text"
                  name="first_name"
                  placeholder="Nombre (contacto)"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
                <Input
                  type="text"
                  name="last_name"
                  placeholder="Apellidos (contacto)"
                  value={formData.last_name}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="tel"
                  name="telefono_contacto"
                  placeholder="Teléfono de contacto público"
                  value={formData.telefono_contacto}
                  onChange={handleChange}
                />
                <Input
                  type="email"
                  name="email_contacto"
                  placeholder="Email de contacto público"
                  value={formData.email_contacto}
                  onChange={handleChange}
                />
              </div>
            </fieldset>

            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta de proveedor'}
            </Button>
          </form>

          <footer className="login-footer mt-6">
            <p>
              ¿Ya eres proveedor? <Link to="/login">Inicia sesión</Link>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default RegisterProvider;
