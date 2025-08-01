// frontend/src/pages/ManageEstablishments.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { getProviderProfile } from '../services/providerService';
import { deleteEstablishment } from '../services/establishmentService'; 
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import Button from '../components/ui/Button';

const EstablishmentCard = ({ establishment, onDelete }) => (
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
    <div className="flex-grow mb-4">
      <h3 className="text-xl font-semibold text-gray-800">{establishment.nombre}</h3>
      <p className="text-gray-500 mt-2 text-sm">{establishment.direccion_completa}</p>
    </div>
    
    <div className="mt-auto pt-4 border-t border-gray-200">
      <div className="flex justify-between items-center mb-4">
        {/* Estos enlaces con texto sí se benefician del componente Button */}
        <Button variant="link" to={`/dashboard/provider/services?est_id=${establishment.id}`}>Servicios</Button>
        <Button variant="link" to={`/dashboard/provider/availability?est_id=${establishment.id}`}>Horario</Button>
        <Button variant="link" to={`/dashboard/provider/appointments?est_id=${establishment.id}&name=${encodeURIComponent(establishment.nombre)}`}>Agenda</Button>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="link" to={`/dashboard/provider/establishments/edit/${establishment.id}`} className="text-gray-600 hover:text-indigo-600">
          <PencilIcon className="h-4 w-4 mr-2" />
          Editar
        </Button>
        
        <button 
          onClick={() => onDelete(establishment.id)}
          className="p-1 rounded-full text-red-600 hover:bg-red-100 hover:text-red-800 transition-colors"
          title="Eliminar establecimiento"
        >
          <TrashIcon className="h-5 w-5" />
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

  // --- handleDeleteEstablishment REFACTORIZADO CON toasts ---
  const handleDeleteEstablishment = async (establishmentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este establecimiento? Se borrarán también todos sus servicios y citas asociadas.')) {
      try {
        await deleteEstablishment(establishmentId);
        // Toast de éxito
        toast.success('Establecimiento eliminado con éxito.');
        // Volvemos a cargar la lista para que el cambio se refleje
        await fetchProfileAndEstablishments(); 
      } catch (err) {
        // Toast de error
        toast.error(err.message || "Error al eliminar el establecimiento.");
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="page-wrapper"><p className="p-4">Cargando establecimientos...</p></div>;
  }

  if (error) {
    return <div className="page-wrapper"><p className="error-message p-4">{error}</p></div>;
  }

  return (
    <div className="page-wrapper">
      <header className="page-header flex justify-between items-center">
        <div>
          <h1>Mis Establecimientos</h1>
          <p>Gestiona los locales donde ofreces tus servicios.</p>
        </div>
        <Link 
          to="/dashboard/provider/establishments/new" 
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Añadir Establecimiento
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {establishments.length > 0 ? (
          establishments.map(est => (
            <EstablishmentCard 
              key={est.id} 
              establishment={est} 
              onDelete={handleDeleteEstablishment}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-10 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">Aún no tienes ningún establecimiento registrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageEstablishments;