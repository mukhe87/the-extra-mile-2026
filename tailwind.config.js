/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The Extra Mile / 7-Eleven brand palette (from the event logo).
        seven: {
          orange: '#F58220',
          green: '#008061',
          red: '#EE1C25',
          dark: '#101820',
          road: '#1A1A1A',
          line: '#F6C700', // road dashes
          cream: '#FFF8EE',
        },
      },
      fontFamily: {
        display: ['"Arial Black"', 'Impact', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
