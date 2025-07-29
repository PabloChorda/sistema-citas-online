// frontend/src/components/ClientInfoCard.jsx
import { useState } from 'react';
import { updateClientProfile } from '../services/clientService';

export default function ClientInfoCard({ profile, onProfileUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: profile.phone_number || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCancel = () => {
        setFormData({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            phone_number: profile.phone_number || '',
        });
        setIsEditing(false);
        setError('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            const updatedData = await updateClientProfile(formData);
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
                <h3>Mis Datos Personales</h3>
                {!isEditing && <button onClick={() => setIsEditing(true)}>Editar</button>}
                {isEditing && (
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
                    <p><strong>Email:</strong> {profile.email}</p>
                    <p><strong>Nombre:</strong> {profile.first_name || 'No especificado'}</p>
                    <p><strong>Apellidos:</strong> {profile.last_name || 'No especificado'}</p>
                    <p><strong>Teléfono:</strong> {profile.phone_number || 'No especificado'}</p>
                </div>
            ) : (
                <div className="form-grid">
                    <label><span>Nombre:</span><input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} /></label>
                    <label><span>Apellidos:</span><input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} /></label>
                    <label><span>Teléfono:</span><input type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} /></label>
                </div>
            )}
        </div>
    );
}