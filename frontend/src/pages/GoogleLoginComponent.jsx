// frontend/src/components/GoogleLoginComponent.jsx

import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleLoginComponent = ({ onLogin }) => {
  const [error, setError] = useState(null);

  const handleSuccess = (credentialResponse) => {
    const googleToken = credentialResponse?.credential;
    if (googleToken && onLogin) onLogin(googleToken);
  };

  const handleError = () => {
    setError('Error al iniciar sesión con Google.');
  };

  return (
    <div className="google-login-container">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        ux_mode="popup"
        useOneTap
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
};

export default GoogleLoginComponent;
