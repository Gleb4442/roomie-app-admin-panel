import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-syne)', 'serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      colors: {
        canvas: '#0D1117',
        surface: '#161B22',
        overlay: '#1C2230',
        border: 'rgba(255,255,255,0.07)',
        gold: {
          DEFAULT: '#F0A500',
          dim: '#C88B00',
          glow: 'rgba(240,165,0,0.15)',
        },
        teal: {
          DEFAULT: '#10B981',
          dim: '#059669',
          glow: 'rgba(16,185,129,0.15)',
        },
        rose: {
          DEFAULT: '#F43F5E',
          dim: '#E11D48',
          glow: 'rgba(244,63,94,0.15)',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#94A3B8',
          400: '#64748B',
          500: '#475569',
          600: '#334155',
          700: '#1E293B',
          800: '#0F172A',
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        'gold-gradient': 'linear-gradient(135deg, #F0A500 0%, #FFD166 100%)',
        'surface-gradient': 'linear-gradient(180deg, #1C2230 0%, #161B22 100%)',
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
        'grid-md': '40px 40px',
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(240,165,0,0.2)',
        'teal-glow': '0 0 20px rgba(16,185,129,0.2)',
        'rose-glow': '0 0 20px rgba(244,63,94,0.2)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
