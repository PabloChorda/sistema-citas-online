// frontend/src/components/provider/ServiceList.jsx

import React from 'react';
import ServiceListItem from './ServiceListItem';

const ServiceList = ({ services, onEditService, onDeleteService }) => {
  if (services.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Aún no has añadido ningún servicio.</p>
        <p className="mt-2">¡Crea tu primer servicio para empezar a recibir citas!</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        {/* --- AÑADE LA CLASE AQUÍ --- */}
        <thead className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
          <tr>
            <th className="py-3 px-6 text-left">Nombre del Servicio</th>
            <th className="py-3 px-6 text-center">Duración</th>
            <th className="py-3 px-6 text-center">Precio</th>
            <th className="py-3 px-6 text-center">Estado</th>
            <th className="py-3 px-6 text-center">Acciones</th>
          </tr>
        </thead>
        {/* --- Y TAMBIÉN AQUÍ --- */}
        <tbody className="text-gray-700 text-sm font-light">
          {services.map((service) => (
            <ServiceListItem
              key={service.id}
              service={service}
              onEdit={onEditService}
              onDelete={onDeleteService}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceList;