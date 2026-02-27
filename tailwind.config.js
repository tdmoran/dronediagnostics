/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gps-red': '#ef4444',
        'gps-yellow': '#eab308',
        'gps-green': '#22c55e',
        'gps-gray': '#6b7280',
      },
    },
  },
  plugins: [],
};
