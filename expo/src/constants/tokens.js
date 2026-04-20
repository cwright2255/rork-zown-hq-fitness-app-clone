export const Colors = {
  primary: '#6C63FF',
  primaryDark: '#5A52D5',
  secondary: '#FF6584',
  accent: '#43D9AD',
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceElevated: '#252540',
  error: '#FF4D6D',
  success: '#43D9AD',
  warning: '#FFB830',
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0C0',
    disabled: '#5A5A7A',
  },
  border: '#2A2A4A',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

