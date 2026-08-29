/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#d32f2f',
          600: '#c62828',
          700: '#b71c1c',
          800: '#9a0007',
          900: '#7f0000',
        },
        blue: {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#d32f2f',
          600: '#c62828',
          700: '#b71c1c',
          800: '#9a0007',
          900: '#7f0000',
        },
      },
    },
  },
  plugins: [],
}
