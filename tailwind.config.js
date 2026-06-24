/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tambahkan baris ini agar Tailwind merespon atribut class="dark" di <html>
  darkMode: 'class', 
  
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}