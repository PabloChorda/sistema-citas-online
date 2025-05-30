// src/App.jsx
import { useState } from 'react';
import './App.css';
import Login from './pages/Login';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  if (!token) {
    return <Login setToken={setToken} setRole={setRole} />;
  }

  return (
    <div className="app-container">
      <h1>Bienvenido</h1>
      <p>Tu rol es: <strong>{role}</strong></p>
      <p>Token JWT:</p>
      <code>{token}</code>
    </div>
  );
}

export default App;
