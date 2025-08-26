import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Colors from '@/constants/colors';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' | 'outline';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Badge: React.FC<BadgeProps> = React.memo(({
  children,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
}) => {
  // Memoize badge style calculation
  const badgeStyle = React.useMemo(() => {
    let baseStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle = styles.primaryBadge;
        break;
      case 'secondary':
        baseStyle = styles.secondaryBadge;
        break;
      case 'success':
        baseStyle = styles.successBadge;
        break;
      case 'warning':
        baseStyle = styles.warningBadge;
        break;
      case 'error':
        baseStyle = styles.errorBadge;
        break;
      case 'neutral':
        baseStyle = styles.neutralBadge;
        break;
      case 'outline':
        baseStyle = styles.outlineBadge;
        break;
    }
    
    // Size styles
    switch (size) {
      case 'small':
        return { ...baseStyle, ...styles.smallBadge };
      case 'medium':
        return { ...baseStyle, ...styles.mediumBadge };
      case 'large':
        return { ...baseStyle, ...styles.largeBadge };
      default:
        return baseStyle;
    }
  }, [variant, size]);
  
  // Memoize text style calculation
  const textStyleComputed = React.useMemo(() => {
    let baseTextStyle: TextStyle = {};
    
    // Variant text styles
    switch (variant) {
      case 'primary':
        baseTextStyle = styles.primaryText;
        break;
      case 'secondary':
        baseTextStyle = styles.secondaryText;
        break;
      case 'success':
        baseTextStyle = styles.successText;
        break;
      case 'warning':
        baseTextStyle = styles.warningText;
        break;
      case 'error':
        baseTextStyle = styles.errorText;
        break;
      case 'neutral':
        baseTextStyle = styles.neutralText;
        break;
      case 'outline':
        baseTextStyle = styles.outlineText;
        break;
    }
    
    // Size text styles
    switch (size) {
      case 'small':
        return { ...baseTextStyle, ...styles.smallText };
      case 'medium':
        return { ...baseTextStyle, ...styles.mediumText };
      case 'large':
        return { ...baseTextStyle, ...styles.largeText };
      default:
        return baseTextStyle;
    }
  }, [variant, size]);
  
  return (
    <View style={[badgeStyle, style]}>
      <Text style={[textStyleComputed, textStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // Variant styles
  primaryBadge: {
    backgroundColor: `${Colors.primary}20`, // 20% opacity
    borderRadius: 100,
  },
  secondaryBadge: {
    backgroundColor: `${Colors.secondary}20`,
    borderRadius: 100,
  },
  successBadge: {
    backgroundColor: `${Colors.success}20`,
    borderRadius: 100,
  },
  warningBadge: {
    backgroundColor: `${Colors.warning}20`,
    borderRadius: 100,
  },
  errorBadge: {
    backgroundColor: `${Colors.error}20`,
    borderRadius: 100,
  },
  neutralBadge: {
    backgroundColor: `${Colors.text.tertiary}20`,
    borderRadius: 100,
  },
  outlineBadge: {
    backgroundColor: 'transparent',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  
  // Size styles
  smallBadge: {
    paddingVertical: 2,
    paddingHorizontal: Colors.spacing.sm,
  },
  mediumBadge: {
    paddingVertical: Colors.spacing.xs,
    paddingHorizontal: Colors.spacing.md,
  },
  largeBadge: {
    paddingVertical: Colors.spacing.xs + 2,
    paddingHorizontal: Colors.spacing.lg,
  },
  
  // Text styles
  primaryText: {
    color: Colors.primary,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  secondaryText: {
    color: Colors.secondary,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  successText: {
    color: Colors.success,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  warningText: {
    color: Colors.warning,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  errorText: {
    color: Colors.error,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  neutralText: {
    color: Colors.text.secondary,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  outlineText: {
    color: Colors.text.secondary,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  
  // Text size styles
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeText: {
    fontSize: 14,
  },
});

export default Badge;