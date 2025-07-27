// frontend/src/components/ui/Button.jsx

import React from 'react';

// Usaremos la librería `clsx` para combinar clases de forma condicional.
// Es una pequeña utilidad muy popular. Instálala: npm install clsx
import clsx from 'clsx';

const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '' }) => {
  
  // Definimos los estilos base que todos los botones comparten
  const baseStyles = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';

  // Definimos los estilos para cada "variante" de botón
  const variantStyles = {
    primary: 'border-transparent bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'border-transparent bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
    danger: 'border-transparent bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    outline: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-indigo-500'
  };

  // Combinamos las clases: las base, las de la variante, y cualquier clase extra que se pase
  const combinedClassName = clsx(
    baseStyles,
    variantStyles[variant],
    disabled && 'opacity-50 cursor-not-allowed', // Estilos si está deshabilitado
    className // Clases personalizadas pasadas como prop
  );

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