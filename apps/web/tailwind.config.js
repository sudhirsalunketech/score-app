/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
        },
        scoring: {
          DEFAULT: 'var(--color-scoring)',
          on: 'var(--color-scoring-on)',
        },
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        live: 'var(--color-live)',
        bg: 'var(--color-bg)',
        muted: 'var(--color-muted)',
        surface: 'var(--color-surface)',
        hero: 'var(--color-hero)',
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
        },
        border: 'var(--color-border)',
        'dark-chrome': 'var(--color-dark-chrome)',
        gold: 'var(--color-gold)',
        'club-card': 'var(--color-club-card)',
        'on-dark': 'var(--color-on-dark)',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['Teko', 'Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        'card-lg': '24px',
        pill: '999px',
      },
      minHeight: {
        touch: '44px',
        scoring: '48px',
      },
      minWidth: {
        touch: '44px',
        scoring: '48px',
      },
      zIndex: {
        overlay: '1000',
        sheet: '1100',
        toast: '1200',
      },
      screens: {
        xs: '360px',
        sm: '430px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  plugins: [],
};
