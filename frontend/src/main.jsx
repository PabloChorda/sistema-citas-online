// frontend/src/main.jsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Importamos el proveedor de Google
import { GoogleOAuthProvider } from '@react-oauth/google';

// --- USAMOS DIRECTAMENTE EL CLIENT ID QUE SABEMOS QUE FUNCIONA ---
const GOOGLE_CLIENT_ID = "618642945850-i4rekbfl4g49760m2jb11rocvnf29ji4.apps.googleusercontent.com";


const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    {/* Ahora el clientId tiene un valor correcto y no será undefined */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);