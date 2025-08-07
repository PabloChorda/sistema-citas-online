// frontend/src/layouts/Footer.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
        <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-4 text-sm">
          {/* Estos enlaces no llevarán a ningún sitio por ahora, pero preparan la estructura */}
          <Link to="/about" className="hover:text-gray-800">Sobre Nosotros</Link>
          <Link to="/contact" className="hover:text-gray-800">Contacto</Link>
          <Link to="/terms" className="hover:text-gray-800">Términos y Condiciones</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;