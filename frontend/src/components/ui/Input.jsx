// frontend/src/components/ui/Input.jsx (Versión para Login.css)

import React from 'react';
import clsx from 'clsx';

const Input = ({ type = 'text', name, id, value, onChange, placeholder, required = false, className = '' }) => {
  // Ahora usamos una clase genérica que puede ser estilizada por Login.css
  const combinedClassName = clsx('form-input', className);

  return (
    <input
      type={type}
      name={name}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={combinedClassName}
    />
  );
};
export default Input;