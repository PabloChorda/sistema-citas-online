// frontend/src/pages/Register.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerUser } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

function Register() {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone_number: ''
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
            const data = await registerUser(formData);
            toast.success(data.msg || "¡Registro exitoso! Revisa tu email para validar la cuenta.");
            
            setTimeout(() => {
                navigate('/login');
            }, 2500); // Damos un poco de tiempo para leer el toast
        } catch (err) {
            toast.error(err.message || "Ocurrió un error durante el registro.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-container">
          <main className="login-box">
            <header className="login-header">
              <h1>Crear Cuenta de Cliente</h1>
              <p>Únete para empezar a reservar tus citas</p>
            </header>
      
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                name="first_name"
                placeholder="Nombre"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
              <Input
                type="text"
                name="last_name"
                placeholder="Apellidos"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
              <Input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <Input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <Input
                type="tel"
                name="phone_number"
                placeholder="Teléfono (Opcional)"
                value={formData.phone_number}
                onChange={handleChange}
              />
      
              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registrando...' : 'Registrarse'}
                </Button>
              </div>
            </form>
      
            <footer className="login-footer">
              <p>¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link></p>
            </footer>
          </main>
        </div>
      )
    }

export default Register;