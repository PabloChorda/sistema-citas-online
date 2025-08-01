// frontend/src/pages/ManageAvailability.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';

// Servicios de API
import { getAvailability, createAvailabilityRule, deleteAvailabilityRule, updateAvailabilityRule } from '../services/availabilityService';

// Componentes
import DayAvailability from '../components/availability/DayAvailability';
import AvailabilityModal from '../components/availability/AvailabilityModal';

// Hook personalizado para leer parámetros de la URL
function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

const ManageAvailability = () => {
  const query = useQuery();
  const establishmentId = query.get('est_id');

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para controlar el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Función para cargar los datos de disponibilidad desde la API
  const fetchAvailability = useCallback(async () => {
    if (!establishmentId) return;
    try {
      setLoading(true);
      const response = await getAvailability(establishmentId);
      setRules(response);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar la disponibilidad.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  // Cargar los datos iniciales cuando el componente se monta
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Agrupamos las reglas por día para facilitar el renderizado
  const rulesByDay = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = rules.filter(rule => rule.dia_semana === day).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      return acc;
    }, {});
  }, [rules]);


  // --- MANEJADORES DE EVENTOS ---

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
    try {
      if (ruleToEdit) {
        // Lógica de Actualización
        await updateAvailabilityRule(ruleToEdit.id, formData);
      } else {
        // Lógica de Creación
        await createAvailabilityRule(establishmentId, formData);
      }
      handleCloseModal();
      await fetchAvailability(); // Recargamos para ver los cambios
    } catch (err) {
      alert('Error al guardar el horario: ' + err.message);
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este horario?')) {
      try {
        await deleteAvailabilityRule(ruleId);
        await fetchAvailability(); // Recargamos para ver los cambios
      } catch (err) {
        alert('Error al eliminar la regla: ' + err.message);
        console.error(err);
      }
    }
  };


  if (!establishmentId) {
    return <div className="page-wrapper"><p className="error-message">Error: Falta el ID del establecimiento en la URL.</p></div>;
  }
  
  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Gestionar Disponibilidad</h1>
        <p>Define tus horarios de trabajo recurrentes. Estos se usarán para generar los huecos de cita.</p>
      </header>

      {loading && <p className="p-4">Cargando horarios...</p>}
      {error && <p className="error-message p-4">{error}</p>}
      
      {!loading && !error && (
        // Usamos una Card para envolver la lista de días
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

export default ManageAvailability;