// frontend/src/components/ui/Input.jsx
import React, { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(function Input(
  {
    type = 'text',
    name,
    id,
    value,
    onChange,
    placeholder,
    required = false,
    className = '',
    disabled = false,
    readOnly = false,
    autoComplete,
    ...rest
  },
  ref
) {
  const isLocked = !!disabled || !!readOnly;

  const combinedClassName = clsx(
    'w-full rounded-md border px-4 py-2 text-sm shadow-sm transition duration-150 ease-in-out',
    // base
    'border-gray-300 text-gray-800 placeholder-gray-400 bg-gray-50',
    // focus
    !isLocked && 'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
    // locked styles
    isLocked && 'bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-0 focus:border-gray-300',
    className
  );

  return (
    <input
      ref={ref}
      type={type}
      name={name}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      // tips de accesibilidad útiles si los pasas desde fuera
      // aria-invalid, aria-describedby, etc. llegarán vía {...rest}
      className={combinedClassName}
      {...rest}
    />
  );
});

export default Input;
