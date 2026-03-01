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
        'bf-bg': '#141414',
        'bf-surface': '#1f1f1f',
        'bf-surface-light': '#242424',
        'bf-accent': '#ffbb00',
        'bf-accent-dark': '#e6a800',
        'bf-text': '#f2f2f2',
        'bf-text-muted': '#8c8c8c',
        'bf-border': '#333333',
        'bf-success': '#96e212',
        'bf-danger': '#e2123f',
        'bf-warning': '#ff6600',
        'bf-info': '#17a2b8',
        // Legacy GPS colors mapped to Betaflight scheme
        'gps-red': '#e2123f',
        'gps-yellow': '#ffbb00',
        'gps-green': '#96e212',
        'gps-gray': '#8c8c8c',
      },
      fontFamily: {
        sans: ['Open Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'bf': '0.25rem',
      },
      boxShadow: {
        'bf': '0 1px 3px rgba(0,0,0,0.4)',
        'bf-lg': '0 4px 12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
