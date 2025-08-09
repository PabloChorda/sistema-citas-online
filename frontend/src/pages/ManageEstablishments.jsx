// frontend/src/pages/ManageEstablishments.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { getProviderProfile } from '../services/providerService';
import { deleteEstablishment } from '../services/establishmentService';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import Button from '../components/ui/Button';

const EstablishmentCard = ({ establishment, onDelete }) => (
  <div className="bg-white border border-gray-200 rounded-xl shadow-card p-5 flex flex-col">
    {/* Header */}
    <div className="flex-grow mb-3">
      <h3 className="text-lg font-semibold text-gray-900">{establishment.nombre}</h3>
      <p
        className="text-gray-500 mt-1 text-sm text-ellipsis whitespace-nowrap"
        title={establishment.direccion_completa}
      >
        {establishment.direccion_completa || '—'}
      </p>
    </div>

    {/* Actions */}
    <div className="mt-auto pt-4 border-t border-gray-200">
      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Button
          variant="secondarySoft"
          size="md"
          className="w-full truncate"
          to={`/dashboard/provider/staff?est_id=${establishment.id}&name=${encodeURIComponent(
            establishment.nombre
          )}`}
        >
          Personal
        </Button>

        <Button
          variant="secondarySoft"
          size="md"
          className="w-full truncate"
          to={`/dashboard/provider/services?est_id=${establishment.id}`}
        >
          Servicios
        </Button>

        <Button
          variant="primarySoft"
          size="md"
          className="w-full truncate"
          to={`/dashboard/provider/availability?est_id=${establishment.id}`}
        >
          Horario
        </Button>

        <Button
          variant="primarySoft"
          size="md"
          className="w-full truncate"
          to={`/dashboard/provider/appointments?est_id=${establishment.id}&name=${encodeURIComponent(
            establishment.nombre
          )}`}
        >
          Agenda
        </Button>
      </div>

      {/* Editar / Eliminar */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondarySoft"
          to={`/dashboard/provider/establishments/edit/${establishment.id}`}
          className="text-gray-700 hover:text-brand-600 inline-flex items-center"
        >
          <PencilIcon className="h-4 w-4 mr-2" />
          Editar
        </Button>

        <button
          onClick={() => onDelete(establishment.id)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          title="Eliminar establecimiento"
        >
          <TrashIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Eliminar</span>
        </button>
      </div>
    </div>
  </div>
);

const ManageEstablishments = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfileAndEstablishments = async () => {
    try {
      const profile = await getProviderProfile();
      setEstablishments(profile.establishments || []);
    } catch (err) {
      setError('No se pudo cargar la información de los establecimientos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProfileAndEstablishments();
  }, []);

  const handleDeleteEstablishment = async (establishmentId) => {
    if (
      window.confirm(
        '¿Seguro que quieres eliminar este establecimiento? También se borrarán sus servicios y citas asociadas.'
      )
    ) {
      try {
        await deleteEstablishment(establishmentId);
        toast.success('Establecimiento eliminado con éxito.');
        await fetchProfileAndEstablishments();
      } catch (err) {
        toast.error(err.message || 'Error al eliminar el establecimiento.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="profile-card">
          <p className="text-gray-600">Cargando establecimientos…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="profile-card">
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Mis Establecimientos</h1>
          <p className="text-gray-600 mt-1">Gestiona los locales donde ofreces tus servicios.</p>
        </div>

        <Link
          to="/dashboard/provider/establishments/new"
          className="inline-flex items-center justify-center rounded-lg border border-transparent bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Añadir Establecimiento
        </Link>
      </header>

      {establishments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {establishments.map((est) => (
            <EstablishmentCard
              key={est.id}
              establishment={est}
              onDelete={handleDeleteEstablishment}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8 text-center">
          <p className="text-gray-600 mb-4">
            Aún no tienes ningún establecimiento registrado.
          </p>
          <Link
            to="/dashboard/provider/establishments/new"
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Crear mi primer establecimiento
          </Link>
        </div>
      )}
    </div>
  );
};

export default ManageEstablishments;
