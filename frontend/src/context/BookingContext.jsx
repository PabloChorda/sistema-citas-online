// frontend/src/context/BookingContext.jsx

import React, { createContext, useState, useContext } from 'react';

// Creamos el Contexto
const BookingContext = createContext(null);

// Hook personalizado para usar el contexto
export const useBooking = () => {
  const context = useContext(BookingContext);
  // Esta comprobación es muy útil. Si intentas usar este hook fuera del
  // proveedor, te dará un error claro en lugar de fallar silenciosamente.
  if (context === undefined || context === null) {
    throw new Error('useBooking debe ser usado dentro de un BookingProvider');
  }
  return context;
};

// Componente Proveedor que envuelve la aplicación
export const BookingProvider = ({ children }) => {
  const [bookingDetails, setBookingDetails] = useState(null);

  const setBookingInfo = (details) => {
    setBookingDetails(details);
  };

  const clearBookingInfo = () => {
    setBookingDetails(null);
  };

  const value = {
    bookingDetails,
    setBookingInfo,
    clearBookingInfo,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};