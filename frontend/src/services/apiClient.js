// frontend/src/services/apiClient.js

// --- FORZAMOS LA URL CORRECTA PARA DESCARTAR PROBLEMAS DE .ENV ---
const BASE_URL = 'http://localhost:5001/api';

console.log("API Base URL forzada:", BASE_URL); // Dejamos el log para confirmar

/**
 * Cliente de API centralizado que adjunta automáticamente el token JWT.
 * @param {string} endpoint - El endpoint a llamar (ej: '/provider/profile').
 * @param {string} method - El método HTTP (ej: 'GET', 'POST', 'PUT').
 * @param {object} [body=null] - El cuerpo de la petición para POST o PUT.
 * @returns {Promise<any>} Los datos de la respuesta en formato JSON.
 */
export async function apiClient(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('accessToken');
    
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        // --- LÍNEA MODIFICADA ---
        // Nos aseguramos de que el endpoint empiece con una barra para una unión correcta.
        const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        const response = await fetch(`${BASE_URL}${finalEndpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || `Error ${response.status} en la petición a ${endpoint}`);
        }
        return data;

    } catch (error) {
        console.error('Error en apiClient:', error);
        throw error;
    }
}