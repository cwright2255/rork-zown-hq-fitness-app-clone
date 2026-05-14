import { tokens } from '../../theme/tokens';
export const colors = {
  bg: '#000000',
  surface: '#111111',
  card: '#1A1A1A',
  cardElevated: '#222222',
  border: '#2A2A2A',
  borderLight: '#333333',
  text: '#FFFFFF',
  textSecondary: '#999999',
  textTertiary: '#666666',
  textMuted: '#555555',
  accent: '#FFFFFF',
  accentAlt: '#E0E0E0',
  accentDim: 'rgba(255,255,255,0.08)',
  progressFill: '#FFFFFF',
  progressTrack: '#2A2A2A',
  green: '#22C55E',
  greenDim: 'rgba(34,197,94,0.15)',
  red: '#EF4444',
  redDim: 'rgba(239,68,68,0.15)',
  orange: '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  blue: '#3B82F6',
  blueDim: 'rgba(59,130,246,0.15)',
  purple: '#A855F7',
  purpleDim: 'rgba(168,85,247,0.15)',
  spotify: '#1DB954',
  spotifyDim: 'rgba(29,185,84,0.15)',
  overlay: 'rgba(0,0,0,0.7)',
  shimmer: '#2A2A2A',
  destructive: '#EF4444',
  success: '#22C55E',
};

export const typography = {
  hero: { fontSize: 36, fontWeight: '800', letterSpacing: -1, color: tokens.colors.background.default },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: tokens.colors.background.default },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: tokens.colors.background.default },
  h3: { fontSize: 18, fontWeight: '600', color: tokens.colors.background.default },
  h4: { fontSize: 16, fontWeight: '600', color: tokens.colors.background.default },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: tokens.colors.background.default },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: '#999' },
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#666' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999' },
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
