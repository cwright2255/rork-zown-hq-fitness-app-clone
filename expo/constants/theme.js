import { tokens } from '../../theme/tokens';
export const colors = {
  bg: tokens.colors.grayscale.black,
  surface: tokens.colors.ink.darker,
  card: tokens.colors.ink.darker,
  cardElevated: tokens.colors.legacy.darkSurface,
  border: tokens.colors.legacy.darkSurface,
  borderLight: tokens.colors.ink.dark,
  text: tokens.colors.background.default,
  textSecondary: tokens.colors.sky.dark,
  textTertiary: tokens.colors.ink.light,
  textMuted: tokens.colors.ink.base,
  accent: tokens.colors.background.default,
  accentAlt: tokens.colors.sky.light,
  accentDim: 'rgba(255,255,255,0.08)',
  progressFill: tokens.colors.background.default,
  progressTrack: tokens.colors.legacy.darkSurface,
  green: tokens.colors.green.light,
  greenDim: 'rgba(34,197,94,0.15)',
  red: tokens.colors.legacy.legacy_ef4444,
  redDim: 'rgba(239,68,68,0.15)',
  orange: tokens.colors.legacy.legacy_f97316,
  orangeDim: 'rgba(249,115,22,0.15)',
  blue: tokens.colors.brand.lighter,
  blueDim: 'rgba(59,130,246,0.15)',
  purple: tokens.colors.legacy.legacy_a855f7,
  purpleDim: 'rgba(168,85,247,0.15)',
  spotify: tokens.colors.green.base,
  spotifyDim: 'rgba(29,185,84,0.15)',
  overlay: 'rgba(0,0,0,0.7)',
  shimmer: tokens.colors.legacy.darkSurface,
  destructive: tokens.colors.legacy.legacy_ef4444,
  success: tokens.colors.green.light,
};

export const typography = {
  hero: { fontSize: 36, fontWeight: '800', letterSpacing: -1, color: tokens.colors.background.default },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: tokens.colors.background.default },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: tokens.colors.background.default },
  h3: { fontSize: 18, fontWeight: '600', color: tokens.colors.background.default },
  h4: { fontSize: 16, fontWeight: '600', color: tokens.colors.background.default },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: tokens.colors.background.default },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: tokens.colors.sky.dark },
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: tokens.colors.ink.light },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: tokens.colors.sky.dark },
  button: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonSmall: { fontSize: 14, fontWeight: '600' },
  number: { fontSize: 32, fontWeight: '800', letterSpacing: -1, color: tokens.colors.background.default },
  numberSmall: { fontSize: 20, fontWeight: '700', color: tokens.colors.background.default },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 28,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: tokens.colors.grayscale.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: tokens.colors.grayscale.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

export default { colors, typography, spacing, radius, shadows };
