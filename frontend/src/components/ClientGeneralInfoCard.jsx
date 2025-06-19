// src/components/ClientGeneralInfoCard.jsx
import { useState } from 'react';
import { updateClientProfile } from '../services/clientService'; // Asegúrate de tener este servicio

export default function ClientGeneralInfoCard({ profile, onProfileUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: profile.phone_number || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCancel = () => {
        setFormData({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            phone_number: profile.phone_number || ''
        });
        setIsEditing(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await updateClientProfile(formData);
            onProfileUpdate(updated);
            setIsEditing(false);
        } catch (err) {
            alert(`Error al guardar: ${err.message}`);
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="profile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3>Información del Cliente</h3>
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)}>Editar</button>
                ) : (
                    <div>
                        <button onClick={handleSave} disabled={isSaving} style={{ marginRight: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={handleCancel} disabled={isSaving} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    </div>
                )}
            </div>

            {!isEditing ? (
                <div>
                    <p><strong>Email:</strong> {profile.email}</p>
                    <p><strong>Nombre:</strong> {profile.first_name}</p>
                    <p><strong>Apellidos:</strong> {profile.last_name}</p>
                    <p><strong>Teléfono:</strong> {profile.phone_number || 'No especificado'}</p>
                </div>
            ) : (
                <div style={{ width: '100%' }}>
                    <label style={{ display: 'block', marginBottom: '15px' }}>
                        <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nombre:</span>
                        <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                    <label style={{ display: 'block', marginBottom: '15px' }}>
                        <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Apellidos:</span>
                        <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                    <label style={{ display: 'block', marginBottom: '15px' }}>
                        <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Teléfono:</span>
                        <input
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}