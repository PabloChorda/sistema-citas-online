// src/App.jsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  return (
    <Router>
      <Routes>
        {!token ? (
          <>
            <Route path="/login" element={<Login setToken={setToken} setRole={setRole} />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
          </>
        ) : (
          <Route
            path="*"
            element={
              <div className="app-container">
                <h1>Bienvenido</h1>
                <p>Tu rol es: <strong>{role}</strong></p>
                <p>Token JWT:</p>
                <code>{token}</code>
              </div>
            }
          />
        )}
      </Routes>
    </Router>
  );
}

export default App;
