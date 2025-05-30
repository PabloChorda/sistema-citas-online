import { useEffect, useState } from 'react'

function Profile() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('jwtToken')
    if (!token) {
      setError('No hay token de autenticación')
      setLoading(false)
      return
    }

    fetch('http://localhost:5001/api/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.msg || 'Error al obtener el perfil')
        }
        setUser(data)
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Cargando perfil...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div className="profile-container">
      <h1>Perfil del Usuario</h1>
      <p><strong>ID:</strong> {user.user_id}</p>
      <p><strong>Nombre:</strong> {user.name}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Rol:</strong> {user.role}</p>
    </div>
  )
}

export default Profile
