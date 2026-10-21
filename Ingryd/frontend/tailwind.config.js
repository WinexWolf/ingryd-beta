/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: {
      none: '0', DEFAULT: '10px', sm: '6px', md: '10px',
      lg: '14px', xl: '18px', '2xl': '24px', '3xl': '28px', full: '9999px',
    },
    extend: {
      colors: {
        ink:     '#241F17',
        petal:   '#E2596F',
        moss:    '#6F8F4C',
        chalk:   '#D9D2BE',
        danger:  'var(--danger)',
        warn:    'var(--warn)',
        surface: { dark: '#1D1F16', light: '#FFFFFF' },
        rim:     { dark: '#33352A', light: 'rgba(36,31,23,0.12)' },
      },
      fontFamily: {
        display: ['Stardom', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
