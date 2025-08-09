// frontend/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // (opcional) si quieres dark mode por clase:
  // darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#F4F5F6',
          100: '#E1E4E6',
          500: '#1D242B',
          600: '#161B20',
          700: '#11161A',
        },
        brand: {
          50:  '#E6F4FB',
          100: '#B3E0F7',
          500: '#0077C0',
          600: '#0066A8',
          700: '#004F80',
        },
        accent: '#10b981',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(3, 7, 18, 0.06)', // para 'shadow-card'
      },
    },
  },
  plugins: [],
};
