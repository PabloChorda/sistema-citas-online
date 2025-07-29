// frontend/src/main.jsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// --- 1. IMPORTAMOS NUESTRO BOOKINGPROVIDER ---
import { BookingProvider } from './context/BookingContext.jsx';

// Importamos el proveedor de Google
import { GoogleOAuthProvider } from '@react-oauth/google';

// --- USAMOS DIRECTAMENTE EL CLIENT ID QUE SABEMOS QUE FUNCIONA ---
const GOOGLE_CLIENT_ID = "618642945850-i4rekbfl4g49760m2jb11rocvnf29ji4.apps.googleusercontent.com";


const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    {/* Envolvemos la aplicación con ambos proveedores. */}
    {/* El orden entre GoogleOAuthProvider y BookingProvider no es crítico, */}
    {/* pero es una buena práctica tener los proveedores de datos (como Booking) */}
    {/* lo más adentro posible, cerca de la App. */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {/* --- 2. ENVOLVEMOS LA APP CON EL BOOKINGPROVIDER --- */}
      <BookingProvider>
        <App />
      </BookingProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);