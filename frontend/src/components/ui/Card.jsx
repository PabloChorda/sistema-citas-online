// frontend/src/components/ui/Card.jsx (Alternativa)

import React from 'react';
import clsx from 'clsx';

const Card = ({ children, className = '' }) => {
  // Esta versión es más simple y reutiliza la clase CSS que ya tienes definida.
  const combinedClassName = clsx('profile-card', className);

  return (
    <div className={combinedClassName}>
      {children}
    </div>
  );
};

export default Card;