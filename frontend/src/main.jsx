// frontend/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BookingProvider } from './context/BookingContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext.jsx';

// Estilos globales
import './index.css';
import './App.css';

const GOOGLE_CLIENT_ID = '618642945850-i4rekbfl4g49760m2jb11rocvnf29ji4.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BookingProvider>
          <App />
        </BookingProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
