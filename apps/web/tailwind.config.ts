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

        // Primary - Muted blue accent (softer, less saturated)
        primary: {
          50: '#eef6fc',
          100: '#d5e8f7',
          200: '#a8cfed',
          300: '#7ab4de',
          400: '#5196c9',
          500: '#3a7db0',
          600: '#2e6593',
          700: '#254f75',
          800: '#1c3d5a',
          900: '#132c42',
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

        // Semantic colors - Warm, professional trading palette
        // Inspired by TradingView/Bloomberg - warm teal greens and coral reds
        positive: {
          DEFAULT: '#26A69A', // Warm teal-green
          muted: '#00796B',
          subtle: 'rgba(38, 166, 154, 0.1)',
        },
        negative: {
          DEFAULT: '#EF5350', // Warm coral-red
          muted: '#C62828',
          subtle: 'rgba(239, 83, 80, 0.1)',
        },
        warning: {
          DEFAULT: '#FFA726', // Warm orange
          muted: '#EF6C00',
          subtle: 'rgba(255, 167, 38, 0.1)',
        },
        info: {
          DEFAULT: '#42A5F5', // Warm blue
          muted: '#1565C0',
          subtle: 'rgba(66, 165, 245, 0.1)',
        },

        // Trading colors - Warm palette (used throughout the app)
        win: {
          400: '#4DB6AC', // Light teal
          500: '#26A69A', // Main teal-green (TradingView style)
          600: '#00897B', // Dark teal
        },
        loss: {
          400: '#E57373', // Light coral
          500: '#EF5350', // Main coral-red (warm, not magenta)
          600: '#E53935', // Dark coral
        },
        live: {
          400: '#E57373',
          500: '#EF5350',
          600: '#E53935',
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
        'glow-sm': '0 0 10px rgba(58, 125, 176, 0.3)',
        'glow-primary': '0 0 20px rgba(58, 125, 176, 0.3)',
        'glow-accent': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-success': '0 0 20px rgba(38, 166, 154, 0.3)', // Teal glow
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.4)',
        'glow-lg': '0 0 40px rgba(58, 125, 176, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, rgba(58,125,176,0.1) 0%, rgba(139,92,246,0.1) 100%)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(58,125,176,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(58,125,176,0.5)' },
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
