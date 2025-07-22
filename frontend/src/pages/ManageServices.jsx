// frontend/src/pages/ManageServices.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

// Componentes
import ServiceList from '../components/provider/ServiceList';
import ServiceModal from '../components/provider/ServiceModal';
import AddServiceButton from '../components/provider/AddServiceButton';

// Servicios de API
import { getServicesByEstablishment, createService, updateService, deleteService } from '../services/serviceService';

const ManageServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);

  useEffect(() => {
    if (!establishmentId) {
      setServices([]);
      return;
    }

    const fetchServicesForId = async () => {
      try {
        setLoading(true);
        const servicesData = await getServicesByEstablishment(establishmentId);
        setServices(servicesData || []);
        setError(null);
      } catch (err) {
        setError('No se pudieron cargar los servicios para este establecimiento.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServicesForId();
  }, [establishmentId]);

  const handleOpenModal = (service = null) => {
    setServiceToEdit(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setServiceToEdit(null);
  };

  const handleSaveService = async (formData) => {
    if (!establishmentId) {
      alert("No hay un establecimiento seleccionado para guardar el servicio.");
      return;
    }

    // --- CORRECCIÓN: CONVERSIÓN DE TIPOS DE DATOS ---
    const processedData = {
      ...formData,
      // Convertimos los valores de string a número antes de enviar
      duracion_minutos: parseInt(formData.duracion_minutos, 10),
      precio: parseFloat(formData.precio),
    };

    // Verificación de que la conversión fue exitosa
    if (isNaN(processedData.duracion_minutos) || isNaN(processedData.precio)) {
        alert("Por favor, introduce valores numéricos válidos para duración y precio.");
        return;
    }

    try {
      if (serviceToEdit) {
        // Enviamos los datos procesados
        await updateService(serviceToEdit.id, processedData);
      } else {
        // Enviamos los datos procesados
        await createService(establishmentId, processedData);
      }
      handleCloseModal();
      
      // Refrescamos la lista para ver los cambios
      const updatedServices = await getServicesByEstablishment(establishmentId);
      setServices(updatedServices || []);

    } catch (saveError) {
      // El mensaje de error de la API ahora debería ser más específico si hay otros problemas
      alert(`Error al guardar: ${saveError.message || 'Ocurrió un error.'}`);
      console.error("Error al guardar el servicio:", saveError);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!establishmentId) return;
    if (window.confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      try {
        await deleteService(serviceId);
        // Refrescamos la lista
        const updatedServices = await getServicesByEstablishment(establishmentId);
        setServices(updatedServices || []);
      } catch (deleteError) {
        alert(`Error al eliminar: ${deleteError.message || 'Ocurrió un error.'}`);
        console.error("Error al eliminar el servicio:", deleteError);
      }
    }
  };

  // Renderizado condicional si no hay ID en la URL
  if (!establishmentId) {
    return (
      <div className="page-wrapper text-center">
        <header className="page-header">
          <h1>Gestionar Servicios</h1>
        </header>
        <div className="profile-card p-10">
          <p className="text-lg text-gray-600">Por favor, selecciona un establecimiento para ver sus servicios.</p>
          <Link to="/dashboard/provider/establishments" className="mt-4 inline-block text-indigo-600 hover:underline font-semibold">
            Ir a la lista de mis establecimientos
          </Link>
        </div>
      </div>
    );
  }
  
  // Renderizado principal si SÍ hay ID en la URL
  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Gestionar Servicios</h1>
        <p>Estás gestionando los servicios para el establecimiento con ID: {establishmentId}</p>
      </header>
      
      <div className="mb-6 text-right">
        <AddServiceButton onClick={() => handleOpenModal()} />
      </div>

      <div className="profile-card">
        {loading && <p className="p-4">Cargando servicios...</p>}
        {error && <p className="error-message p-4">{error}</p>}
        
        {!loading && !error && (
          <ServiceList 
            services={services}
            onEditService={handleOpenModal}
            onDeleteService={handleDeleteService}
          />
        )}
      </div>

      <ServiceModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveService}
        serviceToEdit={serviceToEdit}
      />
    </div>
  );
};

export default ManageServices;