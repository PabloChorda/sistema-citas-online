// frontend/src/pages/BrowsePage.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getAllPublicEstablishments } from '../services/establishmentService';

// Importamos nuestros componentes de UI
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Componente para la tarjeta de un establecimiento individual
const EstablishmentCard = ({ establishment }) => (
  // Reemplazamos el div principal con nuestro componente Card
  // Usamos 'className' para pasar clases adicionales y ajustar el padding y el flexbox
  <Card className="p-0 flex flex-col">
    {/* Contenido principal de la tarjeta */}
    <div className="p-6 flex-grow">
      <h3 className="text-xl font-bold text-gray-800">{establishment.nombre}</h3>
      <p className="text-gray-600 mt-2">{establishment.direccion_completa}</p>
      <p className="text-sm text-gray-500 mt-1">{establishment.localidad}, {establishment.provincia}</p>
    </div>
    
    {/* Pie de la tarjeta con el botón de acción */}
    <div className="bg-gray-50 px-6 py-4 mt-auto border-t">
      {/* Usamos nuestro componente Button como un enlace de navegación */}
      <Button 
        to={`/booking/${establishment.id}`}
        variant="link"
        className="font-semibold" // Le damos un poco más de peso
      >
        Ver servicios y reservar →
      </Button>
    </div>
  </Card>
);

// Componente principal de la página de búsqueda
const BrowsePage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  // El estado de error ya no es necesario, lo gestionará toast

  useEffect(() => {
    const fetchEstablishments = async () => {
      try {
        setLoading(true);
        const data = await getAllPublicEstablishments();
        setEstablishments(data);
      } catch (err) {
        // Mostramos un toast de error si la carga falla
        toast.error("No se pudieron cargar los establecimientos.");
        console.error("Error fetching public establishments:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishments();
  }, []);

  return (
    // El contenedor de la página ya está bien estilizado
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-12 mt-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Encuentra tu Próxima Cita</h1>
        <p className="mt-3 text-lg text-gray-600">Explora los mejores locales y reserva en segundos.</p>
      </header>

      {/* Mantenemos el mensaje de carga, pero eliminamos el de error */}
      {loading && <p className="text-center text-gray-600">Cargando locales...</p>}
      
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {establishments.length > 0 ? (
            establishments.map(est => <EstablishmentCard key={est.id} establishment={est} />)
          ) : (
            // Mensaje si no hay establecimientos
            <p className="col-span-full text-center text-gray-500 mt-10">No hay establecimientos disponibles en este momento.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default BrowsePage;