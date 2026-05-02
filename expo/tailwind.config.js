import { tokens } from '../theme/tokens';
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
          DEFAULT: tokens.colors.brand.primary,
          dark: tokens.colors.brand.base,
        },
        secondary: tokens.colors.red.light,
        accent: tokens.colors.legacy.legacy_43d9ad,
        background: tokens.colors.ink.darkest,
        surface: {
          DEFAULT: tokens.colors.legacy.darkSurfaceDeep,
          elevated: tokens.colors.legacy.darkSurface,
        },
        error: tokens.colors.red.light,
        success: tokens.colors.legacy.legacy_43d9ad,
        warning: tokens.colors.legacy.legacy_ffb830,
        border: tokens.colors.legacy.darkSurface,
        'text-primary': tokens.colors.background.default,
        'text-secondary': tokens.colors.text.lighter,
        'text-disabled': tokens.colors.text.dark,
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
