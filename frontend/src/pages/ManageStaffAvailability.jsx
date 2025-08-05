// frontend/src/pages/ManageStaffAvailability.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
// Necesitaremos un nuevo servicio de API
import { getStaffAvailability, createStaffAvailabilityRule, updateStaffAvailabilityRule, deleteStaffAvailabilityRule } from '../services/staffService';
import DayAvailability from '../components/availability/DayAvailability';
import AvailabilityModal from '../components/availability/AvailabilityModal';

const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

const ManageStaffAvailability = () => {
  const [searchParams] = useSearchParams();
  const staffId = searchParams.get('staff_id');
  const staffName = searchParams.get('name');

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState(null); // Para editar en el futuro
  const [selectedDay, setSelectedDay] = useState(null);

  const fetchAvailability = useCallback(async () => {
    if (!staffId) return;
    try {
      setLoading(true);
      const response = await getStaffAvailability(staffId);
      setRules(response || []);
    } catch (err) {
      toast.error(err.message || 'Error al cargar la disponibilidad del empleado.');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const rulesByDay = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = rules.filter(rule => rule.dia_semana === day).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      return acc;
    }, {});
  }, [rules]);

  const handleOpenModal = (day = null, rule = null) => {
    setSelectedDay(day);
    setRuleToEdit(rule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setRuleToEdit(null);
    setSelectedDay(null);
  };

  const handleSaveRule = async (formData) => {
    // --- 2. CONECTAMOS LA LÓGICA DE ACTUALIZACIÓN ---
    const promise = ruleToEdit
      ? updateStaffAvailabilityRule(ruleToEdit.id, formData)
      : createStaffAvailabilityRule(staffId, formData);
    
    try {
      await toast.promise(promise, {
        loading: 'Guardando horario...',
        success: `¡Horario ${ruleToEdit ? 'actualizado' : 'guardado'} con éxito!`,
        error: (err) => err.message,
      });
      handleCloseModal();
      await fetchAvailability();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    // --- 3. CONECTAMOS LA LÓGICA DE ELIMINACIÓN ---
    if (window.confirm('¿Estás seguro de que quieres eliminar este horario?')) {
      const promise = deleteStaffAvailabilityRule(ruleId);
      try {
        await toast.promise(promise, {
            loading: 'Eliminando horario...',
            success: '¡Horario eliminado!',
            error: (err) => err.message || 'No se pudo eliminar.',
        });
        await fetchAvailability();
      } catch (err) {
        console.error(err);
      }
    }
  };
  
  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Gestionar Disponibilidad de {staffName || 'Empleado'}</h1>
        <p>Define los horarios de trabajo para este miembro del personal.</p>
      </header>

      {loading && <p className="p-4">Cargando horarios...</p>}
      
      {!loading && (
        <Card>
          <div className="divide-y divide-gray-200">
            {DAYS_OF_WEEK.map(day => (
              <DayAvailability
                key={day}
                dayName={day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()}
                rules={rulesByDay[day] || []}
                onAdd={() => handleOpenModal(day)}
                onEdit={(rule) => handleOpenModal(day, rule)}
                onDelete={handleDeleteRule}
              />
            ))}
          </div>
        </Card>
      )}

      <AvailabilityModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveRule}
        ruleToEdit={ruleToEdit}
        day={selectedDay}
      />
    </div>
  );
};

export default ManageStaffAvailability;