// frontend/src/components/ui/Card.jsx (Alternativa)

import React from 'react';
import clsx from 'clsx';

const Card = ({ children, className = '' }) => {
  const combinedClassName = clsx(
    'bg-white rounded-xl shadow-md p-6',
    className
  );

  return <div className={combinedClassName}>{children}</div>;
};

export default Card;