import React from 'react';
import ServiceListItem from './ServiceListItem';

const ServiceList = ({ services = [], onEditService, onDeleteService }) => {
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
      <table className="min-w-full bg-white text-left">
        <thead className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
          <tr>
            <th className="py-3 px-6">Nombre del Servicio</th>
            <th className="py-3 px-6 text-center">Duración</th>
            <th className="py-3 px-6 text-center">Precio</th>
            <th className="py-3 px-6 text-center">Estado</th>
            <th className="py-3 px-6 text-center">Acciones</th>
          </tr>
        </thead>

        {/* Fondo más oscuro para el cuerpo (gris claro) */}
        <tbody className="text-gray-700 text-sm bg-gray-50">
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
