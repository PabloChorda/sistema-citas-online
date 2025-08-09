// frontend/src/components/ui/Button.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',   // 'primary' | 'secondary' | 'primarySoft' | 'secondarySoft' | 'outline' | 'link' | 'danger'
  size = 'md',           // 'sm' | 'md' | 'lg'
  disabled = false,
  className = '',
  to = null,
  title,
}) => {
  const base =
    'inline-flex items-center justify-center rounded-lg border text-sm font-medium shadow-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out ' +
    'whitespace-nowrap select-none';

  const sizes = {
    sm: 'h-9 px-3 gap-2',
    md: 'h-11 px-4 gap-2',
    lg: 'h-12 px-5 gap-2.5 text-base',
  };

  const variants = {
    primary:
      'border-transparent bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary:
      'border-transparent bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500',
  
    // ✅ Soft reales que se ven sobre blanco (tinte por opacidad)
    primarySoft:
      'border border-primary-100 bg-primary-500/10 text-primary-700 hover:bg-primary-500/15 focus:ring-primary-400',
    secondarySoft:
      'border border-brand-100 bg-brand-500/10 text-brand-700 hover:bg-brand-500/15 focus:ring-brand-400',
  
    outline:
      'border-primary-500 text-primary-600 bg-white hover:bg-gray-50 focus:ring-primary-500',
    link:
      'border-transparent bg-transparent text-brand-600 hover:text-brand-700 hover:underline p-0 shadow-none focus:ring-brand-500',
    danger:
      'border-transparent bg-danger text-white hover:bg-red-600 focus:ring-red-500',
  };

  const disabledCls = 'opacity-50 cursor-not-allowed pointer-events-none';

  const classes = clsx(base, sizes[size], variants[variant], disabled && disabledCls, className);

  if (to && !disabled) return <Link to={to} className={classes} title={title}>{children}</Link>;
  if (to && disabled)  return <span className={classes} aria-disabled="true" title={title}>{children}</span>;

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} title={title}>
      {children}
    </button>
  );
};

export default Button;
