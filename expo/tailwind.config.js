/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C63FF',
          dark: '#5A52D5',
        },
        secondary: '#FF6584',
        accent: '#43D9AD',
        background: '#0F0F1A',
        surface: {
          DEFAULT: '#1A1A2E',
          elevated: '#252540',
        },
        error: '#FF4D6D',
        success: '#43D9AD',
        warning: '#FFB830',
        border: '#2A2A4A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0C0',
        'text-disabled': '#5A5A7A',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '15px',
        lg: '17px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
