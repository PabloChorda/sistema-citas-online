// frontend/src/components/ui/Card.jsx
import React from 'react';
import clsx from 'clsx';

const Card = ({ children, className = '' }) => {
  const classes = clsx('bg-white rounded-xl border border-gray-200 shadow-card p-6', className);
  return <div className={classes}>{children}</div>;
};
export default Card;
