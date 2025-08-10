// frontend/src/components/ui/Input.jsx

import React from 'react';
import clsx from 'clsx';

const Input = ({
  type = 'text',
  name,
  id,
  value,
  onChange,
  placeholder,
  required = false,
  className = ''
}) => {
  const combinedClassName = clsx(
    'w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
    'transition duration-150 ease-in-out',
    className
  );

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
