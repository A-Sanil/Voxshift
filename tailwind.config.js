/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0F0F12',
        surface: '#1A1A1F',
        'surface-hover': '#22222A',
        accent: '#7F77DD',
        'accent-dim': 'rgba(127,119,221,0.15)',
        live: '#5DCAA5',
        'live-dim': 'rgba(93,202,165,0.15)',
        'text-primary': '#E8E6E0',
        'text-secondary': '#9A988F',
        border: 'rgba(255,255,255,0.05)',
        'border-strong': 'rgba(255,255,255,0.10)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif'
        ]
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '18px'],
        base: ['13px', '20px'],
        md: ['14px', '20px'],
        lg: ['16px', '24px'],
        xl: ['18px', '28px'],
        '2xl': ['22px', '32px']
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        lg: '12px',
        xl: '16px',
        full: '9999px'
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.4)',
        'card-hover': '0 6px 24px rgba(0,0,0,0.5)',
        accent: '0 0 16px rgba(127,119,221,0.3)',
        live: '0 0 16px rgba(93,202,165,0.25)'
      },
      animation: {
        'pulse-live': 'pulse-live 2.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-out-right': 'slide-out-right 0.2s ease-in forwards'
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        'slide-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(16px)' }
        }
      }
    }
  },
  plugins: []
}
