// frontend/src/pages/BrowsePage.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getAllPublicEstablishments } from '../services/establishmentService';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowRightIcon, MapPinIcon } from '@heroicons/react/24/solid';

const EstablishmentCard = ({ establishment }) => (
  <Card className="p-0 flex flex-col">
    {/* Contenido */}
    <div className="p-6 flex-grow text-left">
      <h3 className="text-lg font-semibold text-gray-900">{establishment.nombre}</h3>

      <div className="mt-2 text-sm text-gray-600 flex items-start gap-2">
        <MapPinIcon className="h-4 w-4 mt-0.5 text-gray-400" />
        <div className="leading-5">
          <p>{establishment.direccion_completa}</p>
          <p className="text-gray-500">
            {establishment.localidad}, {establishment.provincia}
          </p>
        </div>
      </div>
    </div>

    {/* Footer con CTA visible */}
    <div className="bg-gray-50 px-6 py-4 mt-auto border-t">
      <Button
        to={`/booking/${establishment.id}`}
        variant="secondary"                // sólido azul corporativo
        className="w-full sm:w-auto inline-flex items-center gap-2 group"
        aria-label={`Ver servicios y reservar en ${establishment.nombre}`}
      >
        Ver servicios y reservar
        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  </Card>
);

const BrowsePage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEstablishments = async () => {
      try {
        setLoading(true);
        const data = await getAllPublicEstablishments();
        setEstablishments(data || []);
      } catch (err) {
        toast.error('No se pudieron cargar los establecimientos.');
        console.error('Error fetching public establishments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishments();
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <header className="text-center mb-12 sm:mb-16">
        <h1 className="text-3xl sm:text-3xl font-extrabold text-gray-900">
          Encuentra tu Próxima Cita
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
          Explora los mejores locales y reserva en segundos.
        </p>
      </header>

      {loading && (
        <p className="text-center text-gray-600">Cargando locales...</p>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {establishments.length > 0 ? (
            establishments.map((est) => (
              <EstablishmentCard key={est.id} establishment={est} />
            ))
          ) : (
            <p className="col-span-full text-center text-gray-500 mt-10">
              No hay establecimientos disponibles en este momento.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BrowsePage;