// frontend/src/pages/BookingSuccessPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const BookingSuccessPage = () => {
  return (
    <div className="page-wrapper text-center">
      <div className="profile-card max-w-md mx-auto">
        <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="mt-4 text-2xl font-bold">¡Reserva Confirmada!</h1>
        <p className="mt-2 text-gray-600">
          Tu cita ha sido agendada con éxito. Recibirás un correo de confirmación en breve.
        </p>
        <div className="mt-6">
          <Link to="/" className="text-indigo-600 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessPage;