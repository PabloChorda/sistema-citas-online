// frontend/src/pages/BrowsePage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllPublicEstablishments } from '../services/establishmentService';

// Componente para la tarjeta de un establecimiento individual
const EstablishmentCard = ({ establishment }) => (
  <div className="border rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white">
    <div className="p-6">
      {/* Usamos clases de Tailwind para el estilo */}
      <h3 className="text-xl font-bold text-gray-800">{establishment.nombre}</h3>
      <p className="text-gray-600 mt-2">{establishment.direccion_completa}</p>
      <p className="text-sm text-gray-500 mt-1">{establishment.localidad}, {establishment.provincia}</p>
    </div>
    <div className="bg-gray-50 px-6 py-4">
      {/* Este enlace es la conexión clave con la página de reserva que ya construimos */}
      <Link 
        to={`/booking/${establishment.id}`}
        className="text-indigo-600 font-semibold hover:text-indigo-800 transition duration-150 ease-in-out"
      >
        Ver servicios y reservar →
      </Link>
    </div>
  </div>
);

// Componente principal de la página de búsqueda
const BrowsePage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEstablishments = async () => {
      try {
        setLoading(true);
        // Llamamos a la función del servicio que creamos
        const data = await getAllPublicEstablishments();
        setEstablishments(data);
      } catch (err) {
        setError("No se pudieron cargar los establecimientos. Por favor, inténtalo de nuevo.");
        console.error("Error fetching public establishments:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishments();
  }, []); // El array vacío asegura que se ejecute solo una vez

  return (
    // Usamos un layout simple con Tailwind, ya que esta página es pública
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-12 mt-8">
          <h1 className="text-4xl font-extrabold text-gray-900">Encuentra tu Próxima Cita</h1>
          <p className="mt-3 text-lg text-gray-600">Explora los mejores locales y reserva en segundos.</p>
        </header>

        {loading && <p className="text-center text-gray-600">Cargando locales...</p>}
        {error && <p className="error-message text-center">{error}</p>}
        
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {establishments.length > 0 ? (
              establishments.map(est => <EstablishmentCard key={est.id} establishment={est} />)
            ) : (
              <p className="col-span-full text-center text-gray-500">No hay establecimientos disponibles en este momento.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowsePage;