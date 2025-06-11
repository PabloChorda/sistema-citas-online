// src/components/GoogleLoginComponent.jsx
import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const GoogleLoginComponent = ({ onLogin }) => {
  const [error, setError] = useState(null);

  const handleSuccess = (credentialResponse) => {
    try {
      const decoded = credentialResponse.credential; // ✅ Usar jwtDecode, no jwt_decode
      console.log('Decoded JWT:', decoded);
      if (onLogin) {
        onLogin('google', decoded);
      }
    } catch (e) {
      console.error('Error decoding JWT:', e);
      setError('No se pudo procesar la información del usuario.');
    }
  };

  const handleError = () => {
    console.error('Google login failed');
    setError('Error al iniciar sesión con Google.');
  };

  return (
    <div>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap // Puedes quitar esta línea si no deseas el popup automático
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default GoogleLoginComponent;
