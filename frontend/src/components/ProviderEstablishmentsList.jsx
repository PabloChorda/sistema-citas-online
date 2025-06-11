// src/pages/ProviderEstablishmentsList.jsx

import { useEffect, useState } from 'react';
import { getEstablishments } from '../services/establishmentsService';

function ProviderEstablishmentsList({ providerId }) {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!providerId) {
      setMessage('⚠️ Debes proporcionar un ID de proveedor.');
      setLoading(false);
      return;
    }

    getEstablishments(providerId)
      .then(data => {
        setEstablishments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMessage(`❌ Error al cargar establecimientos: ${err.message}`);
        setLoading(false);
      });
  }, [providerId]);

  if (loading) {
    return <p>⏳ Cargando establecimientos...</p>;
  }

  if (message) {
    return <p>{message}</p>;
  }

  if (establishments.length === 0) {
    return <p>📭 No hay establecimientos registrados para este proveedor.</p>;
  }

  return (
    <div className="establishment-list">
      <h2>🏢 Establecimientos del Proveedor</h2>
      <ul>
        {establishments.map(est => (
          <li key={est.id} style={{ border: '1px solid #ccc', marginBottom: '10px', padding: '10px' }}>
            <h3>{est.nombre}</h3>
            <p><strong>Dirección:</strong> {est.direccion_completa}</p>
            <p><strong>Localidad:</strong> {est.localidad}, {est.provincia}</p>
            {est.email && <p><strong>Email:</strong> {est.email}</p>}
            {est.telefono && <p><strong>Teléfono:</strong> {est.telefono}</p>}
            {est.web && <p><strong>Web:</strong> <a href={est.web} target="_blank" rel="noreferrer">{est.web}</a></p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProviderEstablishmentsList;
