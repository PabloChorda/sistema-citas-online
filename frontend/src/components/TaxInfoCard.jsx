// frontend/src/components/TaxInfoCard.jsx
import React from "react";

export default function TaxInfoCard({ profile }) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Información Fiscal</h3>
        <span className="text-xs text-gray-500">Solo lectura</span>
      </div>

      {/* Contenido */}
      <div className="grid gap-3 text-sm text-gray-700">
        <div className="flex items-start">
          <span className="font-medium w-48 text-left">CIF/NIF:</span>
          <span>{profile.cif}</span>
        </div>
        <div className="flex items-start">
          <span className="font-medium w-48 text-left">Dirección Fiscal:</span>
          <span>{profile.direccion_fiscal || "No especificada"}</span>
        </div>
        <div className="flex items-start">
          <span className="font-medium w-48 text-left">Tipo de Empresa:</span>
          <span>{profile.tipo_empresa || "No especificado"}</span>
        </div>
      </div>
    </div>
  );
}
