// src/pages/Profile.jsx

import { useEffect, useState } from 'react';
import { getClientProfile } from '../services/clientService';
import ClientGeneralInfoCard from '../components/ClientGeneralInfoCard';

function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');

    if (!token) {
      setError('No hay token de autenticación');
      setLoading(false);
      return;
    }

    if (role !== 'client') {
      setError('Esta vista es solo para clientes');
      setLoading(false);
      return;
    }

    getClientProfile()
      .then((data) => setUser(data))
      .catch((err) => setError(err.message || 'Error al obtener el perfil'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando perfil...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="profile-wrapper" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>Mi Perfil</h1>
      <ClientGeneralInfoCard profile={user} onProfileUpdate={setUser} />
    </div>
  );
}

export default Profile;