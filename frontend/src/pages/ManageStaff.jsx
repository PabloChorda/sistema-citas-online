// frontend/src/pages/ManageStaff.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/solid';

import { getStaffForEstablishment, addStaffMember, updateStaffMember, deleteStaffMember } from '../services/staffService';
import { getServicesByEstablishment } from '../services/serviceService';
import StaffModal from '../components/provider/StaffModal';

const StaffMemberCard = ({ member, onEdit, onDelete }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0">
        <div>
            <p className="font-bold">{member.first_name} {member.last_name}</p>
            <p className="text-sm text-gray-500">{member.rol}</p>
        </div>
        <div className="flex items-center space-x-4">
            {/* --- NUEVO ENLACE PARA GESTIONAR HORARIO --- */}
            <Button 
                variant="link" 
                size="sm"
                to={`/dashboard/provider/staff/availability?staff_id=${member.id}&name=${encodeURIComponent(member.first_name + ' ' + member.last_name)}`}
            >
                Gestionar Horario
            </Button>
            
            <Button variant="outline" size="sm" onClick={() => onEdit(member)}>
                Editar
            </Button>
            
            <button
                onClick={() => onDelete(member.id)}
                className="p-1 text-red-600 hover:text-red-800"
                title="Eliminar empleado"
            >
                <TrashIcon className="h-5 w-5" />
            </button>
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
            setError("No se ha especificado un establecimiento.");
            setLoading(false);
            return;
        }
        try {
            const [staffData, servicesData] = await Promise.all([
                getStaffForEstablishment(establishmentId),
                getServicesByEstablishment(establishmentId)
            ]);
            setStaff(staffData || []);
            setAvailableServices(servicesData || []);
        } catch (err) {
            setError("No se pudo cargar la información.");
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
        await fetchData(); // Recargamos la lista

      } catch (err) {
        console.error("Error al guardar empleado:", err);
      } finally {
        setIsSubmitting(false);
      }
    };
    const handleDeleteStaff = async (staffId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar a este empleado? Esta acción es permanente.')) {
            const deletePromise = deleteStaffMember(staffId);
            try {
                await toast.promise(deletePromise, {
                    loading: 'Eliminando empleado...',
                    success: '¡Empleado eliminado con éxito!',
                    error: (err) => err.message || 'No se pudo eliminar al empleado.',
                });
                await fetchData(); // Recargamos la lista para que desaparezca
            } catch (err) {
                console.error("Error al eliminar empleado:", err);
            }
        }
    };

    return (
        <div className="page-wrapper">
            <header className="page-header flex justify-between items-center">
                <div>
                    <h1>Gestionar Personal</h1>
                    <p>Añade y gestiona los empleados para <strong>{establishmentName || 'tu establecimiento'}</strong></p>
                </div>
                <Button variant="primary" onClick={() => handleOpenModal()}>
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    Añadir Empleado
                </Button>
            </header>

            <Card>
                {loading && <p className="p-4 text-center">Cargando personal...</p>}
                {error && <p className="error-message p-4 text-center">{error}</p>}
                {!loading && !error && (
                    staff.length > 0 ? (
                        <div>
                            {staff.map(member => (
                                <StaffMemberCard 
                                    key={member.id} 
                                    member={member} 
                                    onEdit={handleOpenModal}
                                    onDelete={handleDeleteStaff} // <-- Descomentar cuando implementemos la eliminación
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="p-4 text-center text-gray-500">Aún no has añadido ningún miembro al personal.</p>
                    )
                )}
            </Card>

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