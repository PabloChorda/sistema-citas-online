// frontend/src/pages/ProviderProfile.jsx
import { useState, useEffect } from 'react';
import { getProviderProfile } from '../services/providerService';
import GeneralInfoCard from '../components/GeneralInfoCard.jsx';
import TaxInfoCard from '../components/TaxInfoCard.jsx';
import ChangePasswordCard from '../components/auth/ChangePasswordCard.jsx';

function ProviderProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getProviderProfile();
        setProfile(data);
      } catch (err) {
        setError(err.message || "Error al cargar el perfil.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileUpdate = (updatedData) => {
    setProfile((prevProfile) => ({
      ...prevProfile,
      ...updatedData,
    }));
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
          Cargando perfil...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="bg-white rounded-lg shadow-sm p-6 text-red-500">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-wrapper">
        <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
          No se encontraron datos del perfil del proveedor.
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="page-header mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Perfil de Proveedor</h1>
        <p className="text-gray-600">
          Gestiona la información de tu negocio
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info general */}
        <GeneralInfoCard
          profile={profile}
          onProfileUpdate={handleProfileUpdate}
        />
        {/* Info fiscal */}
        <TaxInfoCard profile={profile} />

        {/* Cambiar contraseña - ocupa ancho completo */}
        <div className="lg:col-span-2">
          <ChangePasswordCard />
        </div>
      </main>
    </div>
  );
}

export default ProviderProfile;
