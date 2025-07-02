// frontend/src/pages/ManageServices.jsx

import React, { useState, useEffect, useCallback } from 'react';

// Componentes
import ServiceList from '../components/provider/ServiceList';
import ServiceModal from '../components/provider/ServiceModal';
import AddServiceButton from '../components/provider/AddServiceButton';

// Servicios de API
import { getServicesByEstablishment, createService, updateService, deleteService } from '../services/serviceService';
import { getProviderProfile } from '../services/providerService';

const ManageServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado para guardar el establecimiento que se está gestionando
  const [selectedEstablishment, setSelectedEstablishment] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);

  // Función para cargar los servicios del establecimiento seleccionado
  const fetchServices = useCallback(async () => {
    if (!selectedEstablishment) return; // No hacer nada si no hay establecimiento

    try {
      setLoading(true);
      const response = await getServicesByEstablishment(selectedEstablishment.id);
      setServices(response.data);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los servicios para este establecimiento.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEstablishment]); // Depende del establecimiento seleccionado

  // Primer useEffect: se ejecuta una vez para obtener el perfil y los establecimientos
  useEffect(() => {
    const loadProviderData = async () => {
      try {
        const profileData = await getProviderProfile();
        if (profileData && profileData.establishments && profileData.establishments.length > 0) {
          // Si el proveedor tiene establecimientos, seleccionamos el primero por defecto
          setSelectedEstablishment(profileData.establishments[0]);
        } else {
          setError('No tienes ningún establecimiento registrado. Añade uno para poder gestionar servicios.');
          setLoading(false);
        }
      } catch (err) {
        setError('No se pudo cargar la información del proveedor.');
        setLoading(false);
        console.error(err);
      }
    };
    
    loadProviderData();
  }, []); // El array vacío [] asegura que se ejecute solo al montar el componente

  // Segundo useEffect: se ejecuta cada vez que el establecimiento seleccionado cambia
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
    if (!selectedEstablishment) {
      alert("No hay un establecimiento seleccionado para guardar el servicio.");
      return;
    }
    try {
      if (serviceToEdit) {
        await updateService(serviceToEdit.id, formData);
      } else {
        await createService(selectedEstablishment.id, formData);
      }
      handleCloseModal();
      await fetchServices(); // Recargamos la lista
    } catch (saveError) {
      alert(`Error al guardar: ${saveError.message || 'Ocurrió un error.'}`);
      console.error("Error al guardar el servicio:", saveError);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      try {
        await deleteService(serviceId);
        await fetchServices(); // Recargamos la lista
      } catch (deleteError) {
        alert(`Error al eliminar: ${deleteError.message || 'Ocurrió un error.'}`);
        console.error("Error al eliminar el servicio:", deleteError);
      }
    }
  };

  if (loading && !selectedEstablishment) {
    return <div className="page-wrapper"><p className="p-4">Cargando información del proveedor...</p></div>;
  }
  
  if (error) {
    return <div className="page-wrapper"><p className="error-message p-4">{error}</p></div>;
  }

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Gestionar Servicios</h1>
        {selectedEstablishment ? (
          <p>Estás gestionando los servicios para: <strong>{selectedEstablishment.nombre}</strong></p>
        ) : (
          <p>Selecciona un establecimiento para empezar.</p>
        )}
      </header>
      
      {selectedEstablishment && (
        <>
          <div className="mb-6 text-right">
            <AddServiceButton onClick={() => handleOpenModal()} />
          </div>

          <div className="profile-card">
            {loading && <p className="p-4">Cargando servicios...</p>}
            
            {!loading && (
              <ServiceList 
                services={services}
                onEditService={handleOpenModal}
                onDeleteService={handleDeleteService}
              />
            )}
          </div>
        </>
      )}

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
