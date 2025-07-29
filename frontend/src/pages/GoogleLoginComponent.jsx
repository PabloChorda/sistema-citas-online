// frontend/src/components/GoogleLoginComponent.jsx

import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleLoginComponent = ({ onLogin }) => {
  const [error, setError] = useState(null);

  const handleSuccess = (credentialResponse) => {
    // La respuesta de Google ya nos da el token que necesita nuestro backend.
    const googleToken = credentialResponse.credential;
    console.log('Google Token recibido:', googleToken);
    
    if (onLogin) {
      // Llamamos a la función que nos pasaron con el token.
      onLogin(googleToken);
    }
  };

  const handleError = () => {
    console.error('Google login failed');
    setError('Error al iniciar sesión con Google.');
  };

  return (
    <div className="google-login-container">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap
      />
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
};

export default GoogleLoginComponent;