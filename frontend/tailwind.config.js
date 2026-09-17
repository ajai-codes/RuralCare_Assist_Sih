/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          forest: '#0f2922',
          forestLight: '#173d33',
          forestDark: '#081714',
          teal: '#2e8b85',
          tealLight: '#4ca6a1',
          tealDark: '#1d5955',
          cream: '#faf8f5',
          gray: '#f0f2f0',
          earth: '#8b7d6b',
        },
        clinical: {
          emergency: '#b91c1c',
          emergencyLight: '#fee2e2',
          urgent: '#d97706',
          urgentLight: '#fef3c7',
          routine: '#15803d',
          routineLight: '#dcfce7',
          active: '#0369a1',
          activeLight: '#e0f2fe',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
