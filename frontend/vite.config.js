import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Necesitamos el módulo 'path' de Node.js

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Creamos un alias. Cuando Vite vea una importación que empieza por '@fullcalendar',
      // la redirigirá a la ruta absoluta de la carpeta en node_modules.
      '@fullcalendar': path.resolve(__dirname, 'node_modules/@fullcalendar')
    }
  },
  server: {
    // Estas opciones son importantes para Docker
    host: true, // Escucha en todas las interfaces de red
    port: 5173,
    // Permite que el Hot Module Replacement funcione correctamente en Docker
    watch: {
      usePolling: true
    }
  }
})