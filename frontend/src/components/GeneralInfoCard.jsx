// frontend/src/components/GeneralInfoCard.jsx
import { useState } from 'react';
import { updateProviderProfile } from '../services/providerService';

export default function GeneralInfoCard({ profile, onProfileUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        nombre_comercial: profile.nombre_comercial || '',
        telefono_contacto: profile.telefono_contacto || '',
        web: profile.web || '',
        bio: profile.bio || '',
        email_contacto: profile.email_contacto || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleCancel = () => {
        setFormData({
            nombre_comercial: profile.nombre_comercial || '',
            telefono_contacto: profile.telefono_contacto || '',
            web: profile.web || '',
            bio: profile.bio || '',
            email_contacto: profile.email_contacto || '',
        });
        setIsEditing(false);
        setError('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            const updatedData = await updateProviderProfile(formData);
            onProfileUpdate(updatedData);
            setIsEditing(false);
        } catch (error) {
            console.error("Error al guardar el perfil:", error);
            setError(`Error al guardar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="profile-card">
            <div className="profile-card-header">
                <h3>Información General</h3>
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)}>Editar</button>
                ) : (
                    <div>
                        <button onClick={handleSave} disabled={isSaving} className="button-save">
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={handleCancel} disabled={isSaving} className="button-cancel">
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
            {error && <p className="error-message">{error}</p>}
            {!isEditing ? (
                <div>
                    <p><strong>Email de cuenta:</strong> {profile.email}</p>
                    <p><strong>Nombre comercial:</strong> {profile.nombre_comercial}</p>
                    <p><strong>Email de contacto:</strong> {profile.email_contacto || 'No especificado'}</p>
                    <p><strong>Teléfono de contacto:</strong> {profile.telefono_contacto || 'No especificado'}</p>
                    <p><strong>Página web:</strong> {profile.web ? <a href={profile.web} target="_blank" rel="noopener noreferrer">{profile.web}</a> : 'No especificada'}</p>
                    <p><strong>Biografía:</strong> {profile.bio || 'No especificada'}</p>
                </div>
            ) : (
                <div className="form-grid">
                    <label><span>Nombre comercial:</span><input type="text" name="nombre_comercial" value={formData.nombre_comercial} onChange={handleInputChange} /></label>
                    <label><span>Email de contacto:</span><input type="email" name="email_contacto" value={formData.email_contacto} onChange={handleInputChange} /></label>
                    <label><span>Teléfono de contacto:</span><input type="tel" name="telefono_contacto" value={formData.telefono_contacto} onChange={handleInputChange} /></label>
                    <label><span>Página web:</span><input type="url" name="web" placeholder="https://ejemplo.com" value={formData.web} onChange={handleInputChange} /></label>
                    <label className="full-width"><span>Biografía:</span><textarea name="bio" value={formData.bio} onChange={handleInputChange} rows="4"></textarea></label>
                </div>
            )}
        </div>
    );
}