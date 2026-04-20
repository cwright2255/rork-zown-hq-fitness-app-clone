import { Colors, Spacing, Typography, Radius } from './tokens';

export const theme = {
  colors: Colors,
  spacing: Spacing,
  typography: Typography,
  radius: Radius,
} as const;

export type Theme = typeof theme;
export default theme;
