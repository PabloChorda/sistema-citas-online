// src/services/establishmentService.js

const BASE_URL = 'http://localhost:5001/api/establishments';

// Obtener todos los establecimientos (opcional: por provider_id)
export async function getEstablishments(providerId = null) {
  const url = providerId ? `${BASE_URL}/?provider_id=${providerId}` : `${BASE_URL}/`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || 'Error al obtener establecimientos');
  }

  return data;
}

// Obtener un establecimiento por ID
export async function getEstablishmentById(id) {
  const response = await fetch(`${BASE_URL}/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || 'Error al obtener el establecimiento');
  }

  return data;
}

// Crear nuevo establecimiento
export async function createEstablishment(establishmentData) {
  const response = await fetch(`${BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(establishmentData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || 'Error al crear el establecimiento');
  }

  return data;
}

// Actualizar establecimiento existente
export async function updateEstablishment(id, updatedData) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || 'Error al actualizar el establecimiento');
  }

  return data;
}

// Eliminar establecimiento por ID
export async function deleteEstablishment(id) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || 'Error al eliminar el establecimiento');
  }

  return data;
}
