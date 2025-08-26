const Colors = {
  // Primary brand colors - black and white theme
  primary: '#000000',
  primaryLight: '#333333',
  primaryDark: '#000000',
  
  // Secondary colors
  secondary: '#666666',
  secondaryLight: '#888888',
  secondaryDark: '#444444',
  
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  backgroundTertiary: '#EEEEEE',
  
  // Text colors
  text: {
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#888888',
    inverse: '#FFFFFF',
  },
  
  // Card and surface colors
  card: '#FFFFFF',
  surface: '#F5F5F5',
  
  // Border colors
  border: '#DDDDDD',
  
  // Status colors
  success: '#000000',
  warning: '#666666',
  error: '#333333',
  info: '#000000',
  
  // Inactive/disabled
  inactive: '#CCCCCC',
  
  // Running-specific colors
  running: {
    primary: '#000000',
    secondary: '#333333',
    distance: '#666666',
    pace: '#444444',
    calories: '#222222',
  },
  
  // Subscription tier colors
  subscription: {
    free: {
      primary: '#666666',
      background: '#F0F0F0',
      text: '#333333',
    },
    standard: {
      primary: '#000000',
      background: '#F5F5F5',
      text: '#000000',
    },
    elite: {
      primary: '#333333',
      background: '#EEEEEE',
      text: '#000000',
    },
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  
  // Border radius
  radius: {
    small: 4,
    medium: 8,
    large: 12,
    xlarge: 16,
    round: 50,
  },
  
  // Shadows
  shadow: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

export default Colors;