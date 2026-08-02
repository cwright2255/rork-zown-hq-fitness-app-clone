// Real fix, not a redesign: this object was still the dark-navy palette
// from an earlier, incomplete redesign effort that never actually
// shipped - confirmed directly against the real, live Home screen
// (hq.jsx) and profile/edit.jsx, which never migrated to this file and
// still use plain light hex values directly. That's the real theme.
// Discovered this specifically because PrimaryButton.jsx (a shared
// component used across many screens) reads colors.text for its
// background - which was white, rendering as a fully invisible button
// on any of the now-correctly-light screens sitting on a white page.
export const colors = {
  bg: '#FFFFFF',
  surface: '#F0F0F0',
  card: '#F5F5F5',
  cardElevated: '#EEEEEE',
  border: '#E5E5E5',
  borderLight: '#E0E0E0',
  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textMuted: '#AAAAAA',
  accent: '#000000',
  accentAlt: '#333333',
  accentDim: 'rgba(0,0,0,0.06)',
  progressFill: '#000000',
  progressTrack: '#E5E5E5',
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
  shimmer: '#E5E5E5',
  destructive: '#EF4444',
  success: '#22C55E',
};

// Also fixed: these all referenced tokens.colors.dark_navy.text_primary
// (white) or .text_muted/.text_secondary (light grays meant for a dark
// background) - correctly named this time, unlike the earlier bg_primary
// mixup, but still the wrong color family for what's actually a light
// theme. Using plain hex directly here instead of routing through the
// dark_navy token group at all, since that group is inherently tied to
// a dark design context and is exactly how this confusion happened twice.
export const typography = {
  hero: { fontSize: 36, fontWeight: '800', letterSpacing: -1, color: '#000000' },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: '#000000' },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: '#000000' },
  h3: { fontSize: 18, fontWeight: '600', color: '#000000' },
  h4: { fontSize: 16, fontWeight: '600', color: '#000000' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: '#000000' },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: '#AAAAAA' },
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#666666' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#AAAAAA' },
  button: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  buttonSmall: { fontSize: 14, fontWeight: '600' },
  number: { fontSize: 32, fontWeight: '800', letterSpacing: -1, color: '#000000' },
  numberSmall: { fontSize: 20, fontWeight: '700', color: '#000000' },
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

export default { colors, typography, spacing, radius, shadows };
