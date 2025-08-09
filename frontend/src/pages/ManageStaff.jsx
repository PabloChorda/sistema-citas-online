// frontend/src/pages/ManageStaff.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/solid';

import {
  getStaffForEstablishment,
  addStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../services/staffService';
import { getServicesByEstablishment } from '../services/serviceService';
import StaffModal from '../components/provider/StaffModal';

const RolePill = ({ rol }) => (
  <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 text-xs font-medium">
    {rol || '—'}
  </span>
);

const StaffMemberCard = ({ member, onEdit, onDelete }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b last:border-b-0">
    {/* Nombre + rol */}
    <div className="flex-1 min-w-0 flex flex-col items-start text-left">
      <p className="font-semibold text-gray-900 truncate">
        {member.first_name} {member.last_name}
      </p>
      <div className="mt-1">
        <RolePill rol={member.rol} />
      </div>
    </div>

    {/* Acciones */}
    <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
      <Button
        variant="secondarySoft"
        size="sm"
        className="truncate"
        to={`/dashboard/provider/staff/availability?staff_id=${member.id}&name=${encodeURIComponent(
          `${member.first_name} ${member.last_name}`
        )}`}
      >
        Gestionar horario
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit(member)}
        className="truncate"
      >
        Editar
      </Button>

      <Button
        variant="danger"
        size="sm"
        onClick={() => onDelete(member.id)}
        title="Eliminar empleado"
      >
        <TrashIcon className="h-4 w-4 mr-1" />
        Eliminar
      </Button>
    </div>
  </div>
);

const ManageStaff = () => {
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  const [staff, setStaff] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!establishmentId) {
      setError('No se ha especificado un establecimiento.');
      setLoading(false);
      return;
    }
    try {
      const [staffData, servicesData] = await Promise.all([
        getStaffForEstablishment(establishmentId),
        getServicesByEstablishment(establishmentId),
      ]);
      setStaff(staffData || []);
      setAvailableServices(servicesData || []);
    } catch (err) {
      setError('No se pudo cargar la información.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (staffMember = null) => {
    setStaffToEdit(staffMember);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setStaffToEdit(null);
  };

  const handleSaveStaff = async (formData, staffId) => {
    setIsSubmitting(true);
    const isEditing = !!staffId;

    const promise = isEditing
      ? updateStaffMember(staffId, formData)
      : addStaffMember(establishmentId, formData);

    try {
      await toast.promise(promise, {
        loading: 'Guardando empleado...',
        success: `¡Empleado ${isEditing ? 'actualizado' : 'añadido'} con éxito!`,
        error: (err) => err.message || `No se pudo guardar al empleado.`,
      });

      handleCloseModal();
      await fetchData();
    } catch (err) {
      console.error('Error al guardar empleado:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (
      window.confirm(
        '¿Estás seguro de que quieres eliminar a este empleado? Esta acción es permanente.'
      )
    ) {
      const deletePromise = deleteStaffMember(staffId);
      try {
        await toast.promise(deletePromise, {
          loading: 'Eliminando empleado...',
          success: '¡Empleado eliminado con éxito!',
          error: (err) => err.message || 'No se pudo eliminar al empleado.',
        });
        await fetchData();
      } catch (err) {
        console.error('Error al eliminar empleado:', err);
      }
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <header className="page-header flex flex-wrap items-center justify-between gap-3">
        <div className="text-left">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestionar Personal</h1>
          <p className="text-gray-600 mt-1">
            Añade y gestiona los empleados para{' '}
            <strong>{establishmentName || 'tu establecimiento'}</strong>
          </p>
        </div>

        <Button variant="secondary" onClick={() => handleOpenModal()}>
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Añadir empleado
        </Button>
      </header>

      {/* Lista */}
      <Card className="p-0">
        {loading && <p className="p-6 text-center text-gray-600">Cargando personal…</p>}
        {error && <p className="p-6 text-center text-red-600">{error}</p>}

        {!loading && !error && (
          staff.length > 0 ? (
            <div>
              {staff.map((member) => (
                <StaffMemberCard
                  key={member.id}
                  member={member}
                  onEdit={handleOpenModal}
                  onDelete={handleDeleteStaff}
                />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <p className="text-gray-600 mb-4">
                Aún no has añadido ningún miembro al personal.
              </p>
              <Button variant="secondarySoft" onClick={() => handleOpenModal()}>
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                Añadir el primero
              </Button>
            </div>
          )
        )}
      </Card>

      {/* Modal */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveStaff}
        staffToEdit={staffToEdit}
        availableServices={availableServices}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ManageStaff;
