/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0A1628',
          soft: '#33415C',
          muted: '#64748B',
          faint: '#94A3B8',
        },
        page: '#F7F9FC',
        line: {
          DEFAULT: '#E4E9F2',
          strong: '#CFD8E8',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DCEAFE',
          200: '#BBD6FC',
          300: '#8DBAF8',
          400: '#4E93F0',
          500: '#1F74E0',
          600: '#0A5BD3',
          700: '#0847A6',
          800: '#0A3C85',
          900: '#0D3369',
        },
        cache: {
          50: '#ECFDFF',
          100: '#CFF9FE',
          500: '#0FA3B1',
          600: '#0C8492',
          700: '#0A6B77',
        },
        ok: { 50: '#ECFDF5', 100: '#D1FAE5', 500: '#0E9F6E', 600: '#0B7F58', 700: '#08663F' },
        warn: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#D97706', 600: '#B45309', 700: '#92400E' },
        bad: { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#DC2626', 600: '#B91C1C', 700: '#991B1B' },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tighter2: '-0.035em',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 22, 40, 0.04), 0 1px 3px rgba(10, 22, 40, 0.06)',
        lift: '0 10px 30px -12px rgba(10, 22, 40, 0.18), 0 2px 6px rgba(10, 22, 40, 0.06)',
        panel: '0 24px 60px -30px rgba(10, 22, 40, 0.28)',
        focus: '0 0 0 3px rgba(10, 91, 211, 0.28)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.06)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        caret: {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0' },
        },
        spinslow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        rise: 'rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both',
        fade: 'fade 0.5s ease-out both',
        drift: 'drift 22s ease-in-out infinite',
        sheen: 'sheen 0.9s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        caret: 'caret 1.1s steps(1, end) infinite',
        spinslow: 'spinslow 1.1s linear infinite',
      },
    },
  },
  plugins: [],
};
