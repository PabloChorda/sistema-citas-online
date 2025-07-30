// frontend/src/components/ui/Button.jsx

import React from 'react';
// --- 1. IMPORTAMOS Link PARA PODER RENDERIZARLO ---
import { Link } from 'react-router-dom';
import clsx from 'clsx';

// --- 2. AÑADIMOS LA PROP 'to' ---
const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', to = null }) => {
  
  // Definimos los estilos base que todos los botones comparten
  // (He ajustado el padding y añadido 'border' para consistencia con 'outline')
  const baseStyles = 'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out';

  // Definimos los estilos para cada "variante" de botón
  const variantStyles = {
    primary: 'border-transparent bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'border-transparent bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
    danger: 'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    outline: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-indigo-500',
    // --- 3. AÑADIMOS LA NUEVA VARIANTE 'LINK' ---
    // No tiene fondo, ni borde, ni sombra, y el padding es cero para que se comporte como texto.
    link: 'border-transparent bg-transparent text-indigo-600 hover:text-indigo-800 hover:underline p-0 shadow-none focus:ring-indigo-500',
  };

  // Combinamos las clases de forma inteligente
  const combinedClassName = clsx(
    baseStyles,
    variantStyles[variant],
    disabled && 'opacity-50 cursor-not-allowed', // Estilos si está deshabilitado
    className // Clases personalizadas pasadas como prop para sobrescribir o añadir
  );

  // --- 4. LÓGICA CONDICIONAL DE RENDERIZADO ---
  // Si se pasa una prop 'to', significa que queremos un enlace de navegación.
  if (to && !disabled) {
    return (
      <Link to={to} className={combinedClassName}>
        {children}
      </Link>
    );
  }

  // Si no, renderizamos un botón de HTML normal.
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combinedClassName}
    >
      {children}
    </button>
  );
};

export default Button;