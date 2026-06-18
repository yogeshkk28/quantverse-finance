/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0A0A0A',
          800: '#111111',
          700: '#1A1A1A',
          600: '#222222',
        },
        accent: {
          orange: '#F97316',
          amber: '#F59E0B',
        },
        gain: '#10B981',
        loss: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'card-lg': '24px',
      },
      animation: {
        'scroll-ticker': 'scrollTicker 30s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float-blob': 'floatBlob 8s ease-in-out infinite',
        'count-up': 'countUp 1.5s ease-out forwards',
      },
      keyframes: {
        scrollTicker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        floatBlob: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
};
