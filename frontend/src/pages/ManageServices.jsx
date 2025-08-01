// frontend/src/pages/ManageServices.jsx

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, Link } from 'react-router-dom';

import Card from '../components/ui/Card';
import ServiceList from '../components/provider/ServiceList';
import ServiceModal from '../components/provider/ServiceModal';
import AddServiceButton from '../components/provider/AddServiceButton';
import { getServicesByEstablishment, createService, updateService, deleteService } from '../services/serviceService';

const ManageServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);

  const fetchServices = useCallback(async () => {
    if (!establishmentId) {
      setServices([]);
      setLoading(false);
      return;
    }
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
  }, [establishmentId]);
  
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleOpenModal = (service = null) => {
    setServiceToEdit(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setServiceToEdit(null);
  };

  const handleSaveService = async (formData) => {
    if (!establishmentId) return;

    // Convertimos los valores de string a los tipos de datos correctos
    const processedData = {
      ...formData,
      duracion_minutos: parseInt(formData.duracion_minutos, 10),
      precio: parseFloat(formData.precio),
    };

    if (isNaN(processedData.duracion_minutos) || isNaN(processedData.precio)) {
        toast.error("Por favor, introduce valores numéricos válidos para duración y precio.");
        return;
    }
    
    // Creamos la promesa para la API
    const savePromise = serviceToEdit
      ? updateService(serviceToEdit.id, processedData)
      : createService(establishmentId, processedData);

    try {
      await toast.promise(
        savePromise,
        {
          loading: 'Guardando servicio...',
          success: '¡Servicio guardado con éxito!',
          error: (err) => err.message || 'No se pudo guardar el servicio.',
        }
      );

      handleCloseModal();
      await fetchServices();

    } catch (err) {
      console.error("Error al guardar el servicio:", err);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!establishmentId) return;
    
    if (window.confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      try {
        await deleteService(serviceId);
        toast.success('Servicio eliminado correctamente.'); // Toast de éxito
        await fetchServices(); // Recargamos la lista
      } catch (err) {
        toast.error(err.message || 'No se pudo eliminar el servicio.'); // Toast de error
        console.error("Error al eliminar el servicio:", err);
      }
    }
  };

  if (!establishmentId) {
    return (
      <div className="page-wrapper text-center">
        <header className="page-header">
          <h1>Gestionar Servicios</h1>
        </header>
        <Card className="p-10">
          <p className="text-lg text-gray-600">Por favor, selecciona un establecimiento para ver sus servicios.</p>
          <Link to="/dashboard/provider/establishments" className="mt-4 inline-block text-indigo-600 hover:underline font-semibold">
            Ir a la lista de mis establecimientos
          </Link>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Gestionar Servicios</h1>
        <p>Estás gestionando los servicios para el establecimiento con ID: {establishmentId}</p>
      </header>
      
      <div className="mb-6 text-right">
        <AddServiceButton onClick={() => handleOpenModal()} />
      </div>

      <Card>
        {loading && <p className="p-4">Cargando servicios...</p>}
        {error && <p className="error-message p-4">{error}</p>}
        
        {!loading && !error && (
          <ServiceList 
            services={services}
            onEditService={handleOpenModal}
            onDeleteService={handleDeleteService}
          />
        )}
      </Card>

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