import { tokens } from '../../../theme/tokens';
export const Colors = {
  primary: tokens.colors.brand.primary,
  primaryDark: tokens.colors.brand.base,
  secondary: tokens.colors.red.light,
  accent: tokens.colors.legacy.legacy_43d9ad,
  background: tokens.colors.ink.darkest,
  surface: tokens.colors.legacy.darkSurfaceDeep,
  surfaceElevated: tokens.colors.legacy.darkSurface,
  error: tokens.colors.red.light,
  success: tokens.colors.legacy.legacy_43d9ad,
  warning: tokens.colors.legacy.legacy_ffb830,
  text: {
    primary: tokens.colors.background.default,
    secondary: tokens.colors.text.lighter,
    disabled: tokens.colors.text.dark
  },
  border: tokens.colors.legacy.darkSurface
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64
};

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
  }
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999
};