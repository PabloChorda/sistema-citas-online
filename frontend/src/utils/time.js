// frontend/src/utils/time.js

/**
 * Genera un array de strings de tiempo en un intervalo específico y dentro de un rango horario.
 * @param {object} options - Opciones de configuración.
 * @param {number} [options.intervalMinutes=15] - El intervalo en minutos.
 * @param {number} [options.startHour=0] - La hora de inicio (0-23).
 * @param {number} [options.endHour=24] - La hora de fin (0-24).
 * @returns {string[]} - Un array como ["08:00", "08:15", ...].
 */
export const generateTimeSlots = ({ intervalMinutes = 15, startHour = 0, endHour = 24 } = {}) => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  };