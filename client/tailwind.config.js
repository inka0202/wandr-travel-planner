import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' } },
    extend: {
      colors: {
        navy: {
          50: '#F4F6F8',
          100: '#E5EAEF',
          200: '#C8D2DC',
          300: '#9AABBD',
          400: '#647F99',
          500: '#465E78',
          600: '#374C63',
          700: '#2F4255',
          800: '#2C3E50',
          900: '#1B2733',
        },
        orange: {
          50: '#FEF6EE',
          100: '#FCE7D0',
          200: '#F9CFA3',
          300: '#F5B373',
          400: '#F0934A',
          500: '#E67E22',
          600: '#C2671C',
          700: '#9A5117',
          800: '#733D11',
          900: '#4D2A0B',
        },
        cream: '#FAF7F2',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(44, 62, 80, 0.04), 0 1px 3px 0 rgba(44, 62, 80, 0.06)',
        card: '0 2px 4px -1px rgba(44, 62, 80, 0.06), 0 8px 16px -4px rgba(44, 62, 80, 0.08)',
        lift: '0 4px 8px -2px rgba(44, 62, 80, 0.08), 0 16px 32px -8px rgba(44, 62, 80, 0.10)',
      },
    },
  },
  plugins: [forms, typography],
};
