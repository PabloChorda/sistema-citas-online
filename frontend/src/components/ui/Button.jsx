// frontend/src/components/ui/Button.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  to = null,
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out';

  const variantStyles = {
    primary: 'border-transparent bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500',
    secondary: 'border-transparent bg-brand-50 text-brand-700 hover:bg-brand-100 focus:ring-brand-300',
    danger: 'border-transparent bg-danger text-white hover:bg-red-700 focus:ring-danger',
    outline: 'border-brand-500 text-brand-600 bg-white hover:bg-brand-50 focus:ring-brand-500',
    link: 'border-transparent bg-transparent text-brand-600 hover:text-brand-700 hover:underline p-0 shadow-none focus:ring-brand-500',
  };

  const combinedClassName = clsx(
    baseStyles,
    variantStyles[variant],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={combinedClassName}>
        {children}
      </Link>
    );
  }

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
