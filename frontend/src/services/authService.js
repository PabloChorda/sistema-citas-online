// src/services/authService.js
export async function loginUser(email, password) {
    const response = await fetch('http://localhost:5001/api/auth/login', {
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


  // src/services/authService.js

export async function registerUser(userData) {
    const response = await fetch('http://localhost:5001/api/auth/register/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al registrar');
    }
  
    return await response.json();
  }


  // src/services/authService.js

export async function registerProvider(providerData) {
    const response = await fetch('http://localhost:5001/api/auth/register/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerData),
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al registrar proveedor');
    }
  
    return await response.json();
  }
  
  
  