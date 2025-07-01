// frontend/src/pages/ProviderProfile.jsx
import { useState, useEffect } from 'react';
import { getProviderProfile } from '../services/providerService';
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
    if (error) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;

    return (
        <div className="page-wrapper">
            {profile ? (
                <>
                    <header className="page-header">
                        <h1>Perfil de Proveedor</h1>
                        <p>Gestiona la información de tu negocio</p>
                    </header>
                    <main className="profile-content">
                        <GeneralInfoCard profile={profile} onProfileUpdate={handleProfileUpdate} />
                        <TaxInfoCard profile={profile} />
                    </main>
                </>
            ) : (
                <div><p>No se encontraron datos del perfil del proveedor.</p></div>
            )}
        </div>
    );
}

export default ProviderProfile;