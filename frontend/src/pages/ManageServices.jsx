// frontend/src/pages/ManageServices.jsx

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, Link } from 'react-router-dom';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ServiceList from '../components/provider/ServiceList';
import ServiceModal from '../components/provider/ServiceModal';
import { getServicesByEstablishment, createService, updateService, deleteService } from '../services/serviceService';

const ManageServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name'); // opcional

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
  
    const processedData = {
      ...formData,
      duracion_minutos: parseInt(formData.duracion_minutos, 10),
      precio: parseFloat(formData.precio),
    };
  
    if (isNaN(processedData.duracion_minutos) || isNaN(processedData.precio)) {
      toast.error('Por favor, introduce valores numéricos válidos para duración y precio.');
      return;
    }
  
    const isEditing = Boolean(serviceToEdit);
    const savePromise = isEditing
      ? updateService(serviceToEdit.id, processedData)
      : createService(establishmentId, processedData);
  
    try {
      await toast.promise(savePromise, {
        loading: 'Guardando servicio...',
        success: '¡Servicio guardado con éxito!',
        error: (err) => err.message || 'No se pudo guardar el servicio.',
      });
  
      handleCloseModal();
      await fetchServices();
  
      // 🔔 avisa al banner para que pase “Añadir” → “✓ Listo”
      try { window.dispatchEvent(new Event('provider:onboarding:refresh')); } catch {}
    } catch (err) {
      console.error('Error al guardar el servicio:', err);
    }
  };
  
  const handleDeleteService = async (serviceId) => {
    if (!establishmentId) return;
  
    if (window.confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      try {
        await deleteService(serviceId);
        toast.success('Servicio eliminado correctamente.');
        await fetchServices();
  
        // 🔔 refresca el banner (por si te quedas sin servicios y debe volver a “Añadir”)
        try { window.dispatchEvent(new Event('provider:onboarding:refresh')); } catch {}
      } catch (err) {
        toast.error(err.message || 'No se pudo eliminar el servicio.');
        console.error('Error al eliminar el servicio:', err);
      }
    }
  };

  if (!establishmentId) {
    return (
      <div className="page-wrapper text-left">
        <header className="page-header">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestionar Servicios</h1>
        </header>
        <Card className="p-10">
          <p className="text-gray-700">
            Por favor, selecciona un establecimiento para ver sus servicios.
          </p>
          <Link
            to="/dashboard/provider/establishments"
            className="mt-4 inline-block font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Ir a la lista de mis establecimientos
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="page-header flex flex-wrap items-center justify-between gap-3">
        <div className="text-left">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestionar Servicios</h1>
          <p className="text-gray-600 mt-1">
            Establecimiento:{' '}
            <strong>
              {establishmentName ? decodeURIComponent(establishmentName) : `ID ${establishmentId}`}
            </strong>
          </p>
        </div>

        <Button variant="secondary" onClick={() => handleOpenModal()}>
          Añadir servicio
        </Button>
      </header>

      <Card>
        {loading && <p className="p-4 text-gray-600">Cargando servicios...</p>}
        {error && <p className="error-message p-4 text-red-600">{error}</p>}

        {!loading && !error && (
          services.length > 0 ? (
            <ServiceList
              services={services}
              onEditService={handleOpenModal}
              onDeleteService={handleDeleteService}
            />
          ) : (
            <div className="p-10 text-left">
              <p className="text-gray-700 mb-4">Aún no has creado ningún servicio.</p>
              <Button variant="secondarySoft" onClick={() => handleOpenModal()}>
                Crear mi primer servicio
              </Button>
            </div>
          )
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
