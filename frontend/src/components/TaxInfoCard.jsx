// src/components/TaxInfoCard.jsx
import React from 'react';

export default function TaxInfoCard({ profile }) {
  return (
    <div className="profile-card">
      <h3>Información Fiscal</h3>
      <div style={{ marginTop: '15px' }}>
        <p><strong>CIF/NIF:</strong> {profile.cif}</p>
        <p><strong>Dirección Fiscal:</strong> {profile.direccion_fiscal || 'No especificada'}</p>
        <p><strong>Tipo de Empresa:</strong> {profile.tipo_empresa || 'No especificado'}</p>
      </div>
    </div>
  );
}