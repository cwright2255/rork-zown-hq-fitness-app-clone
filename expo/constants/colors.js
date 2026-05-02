import { tokens } from '../../theme/tokens';
const Colors = {
  // Primary brand colors - black and white theme
  primary: tokens.colors.grayscale.black,
  primaryLight: tokens.colors.ink.dark,
  primaryDark: tokens.colors.grayscale.black,

  // Secondary colors
  secondary: tokens.colors.ink.light,
  secondaryLight: tokens.colors.ink.lighter,
  secondaryDark: tokens.colors.ink.base,

  // Background colors
  background: tokens.colors.background.default,
  backgroundSecondary: tokens.colors.sky.lighter,
  backgroundTertiary: tokens.colors.sky.lighter,

  // Text colors
  text: {
    primary: tokens.colors.grayscale.black,
    secondary: tokens.colors.ink.light,
    tertiary: tokens.colors.ink.lighter,
    inverse: tokens.colors.background.default
  },

  // Card and surface colors
  card: tokens.colors.background.default,
  surface: tokens.colors.sky.lighter,

  // Border colors
  border: tokens.colors.sky.light,

  // Status colors
  success: tokens.colors.grayscale.black,
  warning: tokens.colors.ink.light,
  error: tokens.colors.ink.dark,
  info: tokens.colors.grayscale.black,

  // Inactive/disabled
  inactive: tokens.colors.sky.base,

  // Running-specific colors
  running: {
    primary: tokens.colors.grayscale.black,
    secondary: tokens.colors.ink.dark,
    distance: tokens.colors.ink.light,
    pace: tokens.colors.ink.base,
    calories: tokens.colors.legacy.darkSurface
  },

  // Subscription tier colors
  subscription: {
    free: {
      primary: tokens.colors.ink.light,
      background: tokens.colors.sky.lighter,
      text: tokens.colors.ink.dark
    },
    standard: {
      primary: tokens.colors.grayscale.black,
      background: tokens.colors.sky.lighter,
      text: tokens.colors.grayscale.black
    },
    elite: {
      primary: tokens.colors.ink.dark,
      background: tokens.colors.sky.lighter,
      text: tokens.colors.grayscale.black
    }
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24
  },

  // Border radius
  radius: {
    small: 4,
    medium: 8,
    large: 12,
    xlarge: 16,
    round: 50
  },

  // Shadows
  shadow: {
    small: {
      shadowColor: tokens.colors.grayscale.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1
    },
    medium: {
      shadowColor: tokens.colors.grayscale.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2
    },
    large: {
      shadowColor: tokens.colors.grayscale.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4
    }
  }
};

export default Colors;