import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',         // ← Necesario para que sea accesible desde fuera del contenedor
    port: 5173,              // ← Puerto expuesto en docker-compose
    watch: {
      usePolling: true,      // ← Necesario para que funcione el HMR en Docker
    },
    strictPort: true,        // ← Falla si el puerto está ocupado en lugar de cambiarlo
  },
})
