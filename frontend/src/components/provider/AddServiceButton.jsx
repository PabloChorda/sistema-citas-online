// frontend/src/components/provider/AddServiceButton.jsx

import React from 'react';
import { PlusIcon } from '@heroicons/react/24/solid';

const AddServiceButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
      Añadir Servicio
    </button>
  );
};

export default AddServiceButton;