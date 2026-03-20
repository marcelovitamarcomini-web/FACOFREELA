/** @type {import('tailwindcss').Config} */
const config = {
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem',
        lg: '2rem',
        xl: '2.5rem',
      },
    },
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
        },
      },
      boxShadow: {
        soft: '0 20px 60px rgba(15, 23, 42, 0.16)',
      },
      backgroundImage: {
        'hero-grid':
          'linear-gradient(to right, rgba(37, 99, 235, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(37, 99, 235, 0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
