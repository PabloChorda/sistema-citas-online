// src/services/authService.js

const BASE_URL = 'http://localhost:5001/api/auth';

// Iniciar sesión
export async function loginUser(email, password) {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al iniciar sesión');
  }

  return data;
}

// Registro de cliente
export async function registerUser(userData) {
  const response = await fetch(`${BASE_URL}/register/client`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al registrar cliente');
  }

  return data;
}

// Registro de proveedor
export async function registerProvider(providerData) {
  const response = await fetch(`${BASE_URL}/register/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(providerData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al registrar proveedor');
  }

  return data;
}

// Validar cuenta (GET /validate/:token)
export async function validateAccount(token) {
  const response = await fetch(`${BASE_URL}/validate/${token}`, {
    method: 'GET',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al validar cuenta');
  }

  return data;
}

// Solicitar restablecimiento de contraseña (POST /forgot-password)
export async function requestPasswordReset(email) {
  const response = await fetch(`${BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al solicitar restablecimiento');
  }

  return data;
}

// Restablecer contraseña (POST /reset-password/:token)
export async function resetPasswordWithToken(token, password) {
  const response = await fetch(`${BASE_URL}/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || 'Error al restablecer contraseña');
  }

  return data;
}
