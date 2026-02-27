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
        // Betaflight Configurator Color Scheme
        'bf-bg': '#2a2a2a',
        'bf-surface': '#3a3a3a',
        'bf-surface-light': '#4a4a4a',
        'bf-accent': '#ffbb00',
        'bf-accent-dark': '#e6a800',
        'bf-text': '#e0e0e0',
        'bf-text-muted': '#888888',
        'bf-border': '#4a4a4a',
        'bf-success': '#00c851',
        'bf-danger': '#ff4444',
        'bf-warning': '#ffbb00',
        'bf-info': '#17a2b8',
        // Legacy GPS colors mapped to Betaflight scheme
        'gps-red': '#ff4444',
        'gps-yellow': '#ffbb00',
        'gps-green': '#00c851',
        'gps-gray': '#888888',
      },
      fontFamily: {
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'bf': '0.25rem',
      },
    },
  },
  plugins: [],
};
