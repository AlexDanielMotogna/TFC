import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Professional Trading Platform Palette
        // Neutral, clean colors inspired by Bloomberg/TradingView

        // Primary - Subtle blue accent (professional, trustworthy)
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },

        // Accent - Warm neutral for highlights
        accent: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },

        // Surface colors - True neutral grays
        surface: {
          950: '#09090b', // Deepest
          900: '#0c0c0e', // Main background
          850: '#111113', // Card background
          800: '#18181b', // Elevated surface
          700: '#27272a', // Borders
          600: '#3f3f46', // Hover states
          500: '#52525b', // Muted elements
          400: '#71717a', // Secondary text
          300: '#a1a1aa', // Tertiary text
          200: '#d4d4d8', // Light text
          100: '#f4f4f5', // Near white
        },

        // Semantic colors - Muted, professional
        positive: {
          DEFAULT: '#22c55e',
          muted: '#166534',
          subtle: 'rgba(34, 197, 94, 0.1)',
        },
        negative: {
          DEFAULT: '#ef4444',
          muted: '#991b1b',
          subtle: 'rgba(239, 68, 68, 0.1)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#92400e',
          subtle: 'rgba(245, 158, 11, 0.1)',
        },
        info: {
          DEFAULT: '#3b82f6',
          muted: '#1e40af',
          subtle: 'rgba(59, 130, 246, 0.1)',
        },

        // Legacy aliases for compatibility
        win: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        loss: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        live: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'Roboto Mono',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
        'glow-sm': '0 0 10px rgba(14, 165, 233, 0.3)',
        'glow-primary': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-accent': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.3)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.4)',
        'glow-lg': '0 0 40px rgba(14, 165, 233, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(139,92,246,0.1) 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14,165,233,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(14,165,233,0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
