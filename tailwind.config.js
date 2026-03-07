/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          start: '#2d7d7d',
          end: '#2d7d7d',
        },
        accent: {
          DEFAULT: '#2d7d7d',
          light: '#eaf4f4',
          dark: '#1f5c5c',
        },
        slate: {
          deep: '#1e293b',
        },
        warm: {
          bg: '#f5f0eb',
          50: '#faf8f5',
          100: '#f5f0eb',
          200: '#e8e2da',
        },
        teal: {
          DEFAULT: '#2d7d7d',
          light: '#3d9494',
          faint: '#eaf4f4',
        },
        muted: '#94a3b8',
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2d7d7d, #1f5c5c)',
      },
      borderRadius: {
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'elevated': '0 10px 25px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};