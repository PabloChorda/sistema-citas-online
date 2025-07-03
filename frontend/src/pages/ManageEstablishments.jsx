// frontend/src/pages/ManageEstablishments.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProviderProfile } from '../services/providerService';
// --- 1. IMPORTAMOS LA FUNCIÓN deleteEstablishment ---
import { deleteEstablishment } from '../services/establishmentService'; 
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';

// El componente EstablishmentCard ya estaba correcto, no necesita cambios.
const EstablishmentCard = ({ establishment, onDelete }) => (
  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
    <div className="flex-grow">
      <h3 className="text-xl font-semibold text-gray-800">{establishment.nombre}</h3>
      <p className="text-gray-500 mt-2 text-sm">{establishment.direccion_completa}</p>
    </div>
    
    <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
      <Link 
        to={`/provider/establishments/edit/${establishment.id}`}
        className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-indigo-600"
      >
        <PencilIcon className="h-4 w-4 mr-2" />
        Editar
      </Link>
      
    <div className="mt-4 flex justify-between items-center">
        <Link to={`/provider/services?est_id=${establishment.id}`} className="text-sm font-medium text-gray-600 hover:text-gray-800">
        Servicios
      </Link>
        <Link to={`/provider/availability?est_id=${establishment.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
        Gestionar Horario →
      </Link>
    </div>

      <button 
        onClick={() => onDelete(establishment.id)}
        className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800"
        title="Eliminar establecimiento"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
);


const ManageEstablishments = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Esta función se encarga de recargar los datos
  const fetchProfileAndEstablishments = async () => {
    try {
      // No ponemos setLoading(true) aquí para que la recarga sea más sutil
      const profile = await getProviderProfile();
      setEstablishments(profile.establishments || []);
    } catch (err) {
      setError('No se pudo cargar la información de los establecimientos.');
      console.error(err);
    } finally {
      setLoading(false); // Solo ponemos loading a false al final de todo
    }
  };

  useEffect(() => {
    fetchProfileAndEstablishments();
  }, []);

  // --- 2. ACTUALIZAMOS LA FUNCIÓN DE BORRADO ---
  const handleDeleteEstablishment = async (establishmentId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este establecimiento? Se borrarán también todos sus servicios y citas asociadas.')) {
      try {
        // Reemplazamos el console.log con la llamada real a la API
        await deleteEstablishment(establishmentId);
        
        // Refrescamos la lista para que el establecimiento eliminado desaparezca de la UI
        fetchProfileAndEstablishments(); 
      } catch (err) {
        alert(err.message || "Error al eliminar el establecimiento.");
        console.error(err);
      }
    }
  };

  // El renderizado inicial y el manejo de errores se quedan igual
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
          to="/provider/establishments/new" 
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
              onDelete={handleDeleteEstablishment} // La función ya se pasa correctamente
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