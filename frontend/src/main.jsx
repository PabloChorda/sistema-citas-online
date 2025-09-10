// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BookingProvider } from './context/BookingContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Estilos globales
import './index.css';
import './App.css';

const GOOGLE_CLIENT_ID = '618642945850-i4rekbfl4g49760m2jb11rocvnf29ji4.apps.googleusercontent.com';

// Splash minimal
function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-600">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
        <div className="text-sm">Preparando tu sesión…</div>
      </div>
    </div>
  );
}

// Puerta de arranque: muestra Splash hasta que AuthContext termine bootstrapping
function BootGate({ children }) {
  const { bootstrapping } = useAuth();
  if (bootstrapping) return <Splash />;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BookingProvider>
          <BootGate>
            <App />
          </BootGate>
        </BookingProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
