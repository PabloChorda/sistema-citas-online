// src/pages/ProviderProfile.jsx

import { useState, useEffect } from 'react';
import { getProviderProfile } from '../services/providerService';
import '../styles/Login.css'; // Reutilizamos estilos por ahora

import GeneralInfoCard from '../components/GeneralInfoCard.jsx';
import TaxInfoCard from '../components/TaxInfoCard.jsx'; 

function ProviderProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getProviderProfile();
                console.log("Datos recibidos de la API:", data);
                setProfile(data);
            } catch (err) {
                setError(err.message || 'Error al cargar el perfil.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleProfileUpdate = (updatedData) => {
        setProfile(prevProfile => ({ ...prevProfile, ...updatedData }));
    };

    if (loading) return <div className="page-wrapper"><p>Cargando perfil...</p></div>;
    if (error) return <div className="page-wrapper"><p style={{ color: 'red' }}>{error}</p></div>;

    return (
        <div className="page-wrapper">
            {profile ? (
                <>
                    <header className="login-header">
                        <h2>Perfil de: {profile?.nombre_comercial}</h2>
                    </header>
                    <main className="profile-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <GeneralInfoCard profile={profile} onProfileUpdate={handleProfileUpdate} />
                        <TaxInfoCard profile={profile} />
                    </main>
                </>
            ) : (
                <div style={{ padding: '20px' }}><p>No se encontraron datos del perfil del proveedor.</p></div>
            )}
        </div>
    );
}

export default ProviderProfile;