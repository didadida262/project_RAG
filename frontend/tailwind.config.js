/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px var(--tw-shadow-color)',
      },
      keyframes: {
        blob1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(6%, -10%) scale(1.12)' },
        },
        blob2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-8%, 6%) scale(1.08)' },
        },
        blob3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1.05)' },
          '33%': { transform: 'translate(5%, 8%) scale(1)' },
          '66%': { transform: 'translate(-6%, -5%) scale(1.1)' },
        },
      },
      animation: {
        'blob-1': 'blob1 18s ease-in-out infinite',
        'blob-2': 'blob2 22s ease-in-out infinite',
        'blob-3': 'blob3 26s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
