// frontend/src/pages/ClientProfile.jsx
import { useState, useEffect } from 'react';
import { getClientProfile } from '../services/clientService';
import ClientInfoCard from '../components/ClientInfoCard';

function ClientProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getClientProfile();
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Error al cargar el perfil.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileUpdate = (updatedUser) => {
    setProfile(updatedUser);
  };

  if (loading) return <div className="page-wrapper"><p>Cargando perfil...</p></div>;
  if (error) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;

  return (
    <div className="page-wrapper">
      {profile ? (
        <>
          <header className="page-header">
            <h1>Mi Perfil</h1>
            <p>Hola, {profile.first_name || 'usuario'}. Aquí puedes gestionar tus datos.</p>
          </header>
          <main className="profile-content">
            <ClientInfoCard profile={profile} onProfileUpdate={handleProfileUpdate} />
          </main>
        </>
      ) : (
        <div><p>No se encontraron datos del perfil.</p></div>
      )}
    </div>
  );
}

export default ClientProfile;
