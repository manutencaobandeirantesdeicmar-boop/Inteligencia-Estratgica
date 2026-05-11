/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandBlue: '#0f4c81',
        brandEmerald: '#10b981',
      }
    },
  },
  plugins: [],
}