// frontend/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // Esta es la línea más importante. Le decimos que escanee
    // dentro de la carpeta 'src' y TODAS sus subcarpetas ('**')
    // para cualquier archivo que termine en .js, .ts, .jsx, o .tsx.
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}