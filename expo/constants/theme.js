export const colors = {
  bg: '#000000',
  surface: '#111111',
  card: '#1A1A1A',
  cardElevated: '#222222',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#999999',
  textMuted: '#555555',
  accent: '#FFFFFF',
  accentAlt: '#E0E0E0',
  progressFill: '#FFFFFF',
  progressTrack: '#2A2A2A',
  destructive: '#FF3B30',
  success: '#30D158',
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: 1, color: colors.text },
  h2: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5, color: colors.text },
  h3: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  caption: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 28,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};

export default { colors, typography, spacing, radius, shadows };
