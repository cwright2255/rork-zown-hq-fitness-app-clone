const Colors = {
  // Primary brand colors - using main color as default
  primary: '#4A80F0',
  primaryLight: '#6B9BF7',
  primaryDark: '#2E5CE6',
  
  // Secondary colors
  secondary: '#FF6B6B',
  secondaryLight: '#FF8E8E',
  secondaryDark: '#FF4757',
  
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  backgroundTertiary: '#F1F3F4',
  
  // Text colors
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  
  // Card and surface colors
  card: '#FFFFFF',
  surface: '#F8F9FA',
  
  // Border colors
  border: '#E5E7EB',
  
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Inactive/disabled
  inactive: '#D1D5DB',
  
  // Running-specific colors
  running: {
    primary: '#4A80F0',
    secondary: '#10B981',
    distance: '#8B5CF6',
    pace: '#F59E0B',
    calories: '#EF4444',
  },
  
  // Subscription tier colors
  subscription: {
    free: {
      primary: '#6B7280',
      background: '#F3F4F6',
      text: '#374151',
    },
    standard: {
      primary: '#4A80F0',
      background: '#EBF4FF',
      text: '#1E40AF',
    },
    elite: {
      primary: '#F59E0B',
      background: '#FEF3C7',
      text: '#92400E',
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