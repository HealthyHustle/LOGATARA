/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Exact Stitch "Warm Storybook Heritage" Design System Tokens
        surface: '#FFF8F5',
        'surface-bright': '#FFF8F5',
        'surface-dim': '#F8D3BA',
        'surface-lowest': '#FFFFFF',
        'surface-ivory': '#FFFDF8',
        'surface-parchment': '#FDF8EE',
        'surface-rice': '#F7EFE1',
        'surface-low': '#FFF1E9',
        'surface-container': '#FFEADD',
        'surface-high': '#FFE3D1',
        'surface-highest': '#FFDCC5',
        'on-surface': '#2A1708',
        'on-surface-bark': '#5C4331',
        'on-surface-variant': '#434840',
        outline: '#74796F',
        'outline-variant': '#C4C8BD',

        // Primary Forest Canopy & Olive
        primary: '#354C2E',
        'primary-canopy': '#2D4229',
        'primary-olive': '#4C6444',
        'primary-fixed': '#CFEBC2',
        'primary-fixed-dim': '#B3CEA7',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#C4DFB7',

        // Secondary Sunbaked Terracotta
        secondary: '#A23E18',
        'secondary-terracotta': '#C85A32',
        'secondary-deep': '#9E3E1C',
        'secondary-container': '#FE8357',
        'secondary-fixed': '#FFDBCF',
        'secondary-fixed-dim': '#FFB59C',
        'on-secondary': '#FFFFFF',
        'on-secondary-fixed': '#390C00',

        // Tertiary Honeycomb Gold
        tertiary: '#5D4100',
        'tertiary-gold': '#F2B842',
        'tertiary-fixed': '#FFDEA7',
        'tertiary-fixed-dim': '#F8BD47',
        'on-tertiary-fixed': '#271900',

        error: '#BA1A1A',
        'error-container': '#FFDAD6',
        'on-error-container': '#93000A',
      },
      fontFamily: {
        display: ['Quicksand', 'Nunito', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        storybook: '0 2px 4px rgba(92, 67, 49, 0.06), 0 10px 24px rgba(92, 67, 49, 0.08)',
        'storybook-lg': '0 12px 32px rgba(92, 67, 49, 0.14)',
        'storybook-nav': '0 1px 8px rgba(92, 67, 49, 0.06)',
        'tactile-terracotta': '0 4px 0 #822801, 0 8px 18px rgba(162, 62, 24, 0.28)',
        'tactile-olive': '0 4px 0 #243720, 0 8px 18px rgba(53, 76, 46, 0.25)',
        'tactile-gold': '0 4px 0 #B67D15, 0 6px 14px rgba(242, 184, 66, 0.30)',
        'tactile-parchment': '0 3px 0 #DFCEB9, 0 4px 10px rgba(92, 67, 49, 0.08)',
      },
      borderRadius: {
        storybook: '1.5rem',
        'storybook-lg': '2rem',
      },
    },
  },
  plugins: [],
};
