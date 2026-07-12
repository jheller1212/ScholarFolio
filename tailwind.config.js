/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      // Design-system v1.1 type scale — small text nudged up for a lighter, airier feel.
      fontSize: {
        xs: ['13px', '18px'],   // v1.1: was 12px/16px
        sm: ['15px', '22px'],   // v1.1: was 14px/20px
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
          'faint-hover': '#d5ecec',
        },
        muted: '#94a3b8',
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        },
        // Status colors — verified marks, beta tags, ORCID links.
        success: { DEFAULT: '#059669', bg: '#ecfdf5' },
        warning: { DEFAULT: '#b45309', bg: '#fef3c7' },
        orcid: { DEFAULT: '#a6ce39', bg: '#f3f9e8' },
        // Semantic category colors (muted, academic tone) + soft tinted backgrounds.
        cat: {
          impact: { from: '#b08d57', to: '#8b6f47', bg: '#faf6ef' },  // warm amber/gold
          collab: { from: '#2d7d7d', to: '#1f5c5c', bg: '#eaf4f4' },  // teal (brand)
          trend: { from: '#4a6fa5', to: '#3a5a8a', bg: '#eef3fa' },    // slate blue
          field: { from: '#6b5b8a', to: '#554870', bg: '#f3f0f8' },    // muted indigo
          oa: { from: '#4a8c6f', to: '#3a7059', bg: '#eef7f2' },       // sage green
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2d7d7d, #1f5c5c)',
      },
      // Design-system radii — softened for a more modern, rounded surface language.
      borderRadius: {
        lg: '10px',      // v1.1: was 8px — buttons, inputs, dropdowns
        xl: '16px',      // v1.2: 12→14→16 — metric cards, banners
        '2xl': '20px',   // v1.2: 16→18→20 — summary cards, feature cards, modals
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'elevated': '0 10px 25px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
        'btn-lift': '0 4px 12px -2px rgba(45, 125, 125, 0.3)',
      },
    },
  },
  plugins: [],
};