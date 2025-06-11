// src/components/GeneralInfoCard.jsx
import { useState } from 'react';
import { updateProviderProfile } from '../services/providerService';

export default function GeneralInfoCard({ profile, onProfileUpdate }) {
    // --- ESTADOS DEL COMPONENTE ---
    // 1. Controla si estamos en modo edición.
    const [isEditing, setIsEditing] = useState(false);

    // 2. Guarda los datos del formulario mientras se edita.
    const [formData, setFormData] = useState({
        nombre_comercial: profile.nombre_comercial,
        telefono_contacto: profile.telefono_contacto || '',
        web: profile.web || ''
    });

    // 3. Controla el feedback visual mientras se guarda en la API.
    const [isSaving, setIsSaving] = useState(false);


    // --- MANEJADORES DE EVENTOS ---

    // Actualiza el estado del formulario cada vez que el usuario escribe.
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    // Sale del modo edición sin guardar cambios.
    const handleCancel = () => {
        // Restaura el formulario a los datos originales del perfil.
        setFormData({
            nombre_comercial: profile.nombre_comercial,
            telefono_contacto: profile.telefono_contacto || '',
            web: profile.web || ''
        });
        setIsEditing(false);
    };

    // Guarda los cambios en el backend.
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedDataFromServer = await updateProviderProfile(formData);
            onProfileUpdate(updatedDataFromServer); // Actualiza la vista principal con los datos nuevos.
            setIsEditing(false);
        } catch (error) {
            console.error("Error al guardar el perfil:", error);
            alert(`Error al guardar los datos: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDERIZADO DEL COMPONENTE ---
    return (
        <div className="profile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                <h3>Información General</h3>
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
                // MODO VISTA
                <div>
                    <p><strong>Email de cuenta:</strong> {profile.email}</p>
                    <p><strong>Nombre comercial:</strong> {profile.nombre_comercial}</p>
                    <p><strong>Teléfono de contacto:</strong> {profile.telefono_contacto || 'No especificado'}</p>
                    <p><strong>Página web:</strong> <a href={profile.web} target="_blank" rel="noopener noreferrer">{profile.web || 'No especificada'}</a></p>
                </div>
            ) : (
                // MODO EDICIÓN
                <div style={{ width: '100%' }}>
                    <label style={{display: 'block', marginBottom: '15px'}}>
                        <span style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Nombre comercial:</span>
                        <input
                            type="text"
                            name="nombre_comercial"
                            value={formData.nombre_comercial}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                    <label style={{display: 'block', marginBottom: '15px'}}>
                        <span style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Teléfono de contacto:</span>
                        <input
                            type="tel"
                            name="telefono_contacto"
                            value={formData.telefono_contacto}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                    <label style={{display: 'block', marginBottom: '15px'}}>
                        <span style={{fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>Página web:</span>
                        <input
                            type="url"
                            name="web"
                            placeholder="https://ejemplo.com"
                            value={formData.web}
                            onChange={handleInputChange}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}