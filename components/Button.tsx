import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Colors from '@/constants/colors';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: object;
  textStyle?: object;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode; // Added for backward compatibility
  testID?: string;
}

const Button = React.memo(({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  icon, // Added for backward compatibility
  testID,
}: ButtonProps) => {
  // Use icon as leftIcon if provided (for backward compatibility)
  const effectiveLeftIcon = leftIcon || icon;
  
  // Memoize button styles
  const buttonStyles = React.useMemo(() => {
    let variantStyle;
    switch (variant) {
      case 'secondary':
        variantStyle = styles.secondaryButton;
        break;
      case 'outline':
        variantStyle = styles.outlineButton;
        break;
      case 'danger':
        variantStyle = styles.dangerButton;
        break;
      default:
        variantStyle = styles.primaryButton;
    }
    
    let sizeStyle;
    switch (size) {
      case 'small':
        sizeStyle = styles.smallButton;
        break;
      case 'large':
        sizeStyle = styles.largeButton;
        break;
      default:
        sizeStyle = styles.mediumButton;
    }
    
    return [styles.button, variantStyle, sizeStyle];
  }, [variant, size]);
  
  // Memoize text styles
  const textStyles = React.useMemo(() => {
    let variantTextStyle;
    switch (variant) {
      case 'outline':
        variantTextStyle = styles.outlineButtonText;
        break;
      case 'secondary':
        variantTextStyle = styles.secondaryButtonText;
        break;
      case 'danger':
        variantTextStyle = styles.dangerButtonText;
        break;
      default:
        variantTextStyle = styles.primaryButtonText;
    }
    
    let sizeTextStyle;
    switch (size) {
      case 'small':
        sizeTextStyle = styles.smallButtonText;
        break;
      case 'large':
        sizeTextStyle = styles.largeButtonText;
        break;
      default:
        sizeTextStyle = styles.mediumButtonText;
    }
    
    return [styles.buttonText, variantTextStyle, sizeTextStyle];
  }, [variant, size]);
  
  // Memoize activity indicator color
  const indicatorColor = React.useMemo(() => 
    variant === 'outline' ? Colors.primary : Colors.text.inverse,
    [variant]
  );
  
  return (
    <TouchableOpacity
      style={[
        ...buttonStyles,
        disabled && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator 
          color={indicatorColor} 
          size="small" 
        />
      ) : (
        <View style={styles.buttonContent}>
          {effectiveLeftIcon && (
            <View style={styles.leftIconContainer}>
              {effectiveLeftIcon}
            </View>
          )}
          <Text 
            style={[
              ...textStyles,
              disabled && styles.disabledButtonText,
              textStyle
            ]}
          >
            {title}
          </Text>
          {rightIcon && (
            <View style={styles.rightIconContainer}>
              {rightIcon}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    borderRadius: Colors.radius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // Variants
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: Colors.text.inverse,
  },
  secondaryButton: {
    backgroundColor: Colors.secondary,
  },
  secondaryButtonText: {
    color: Colors.text.inverse,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  outlineButtonText: {
    color: Colors.primary,
  },
  dangerButton: {
    backgroundColor: Colors.error,
  },
  dangerButtonText: {
    color: Colors.text.inverse,
  },
  // Sizes
  smallButton: {
    paddingVertical: Colors.spacing.sm,
    paddingHorizontal: Colors.spacing.lg,
  },
  mediumButton: {
    paddingVertical: Colors.spacing.md,
    paddingHorizontal: Colors.spacing.xxl,
  },
  largeButton: {
    paddingVertical: Colors.spacing.lg,
    paddingHorizontal: 32,
  },
  smallButtonText: {
    fontSize: 12,
  },
  mediumButtonText: {
    fontSize: 14,
  },
  largeButtonText: {
    fontSize: 16,
  },
  // States
  disabledButton: {
    backgroundColor: Colors.inactive,
    borderColor: Colors.inactive,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: Colors.text.tertiary,
  },
  // Icons
  leftIconContainer: {
    marginRight: Colors.spacing.sm,
    backgroundColor: 'transparent',
  },
  rightIconContainer: {
    marginLeft: Colors.spacing.sm,
    backgroundColor: 'transparent',
  },
});

Button.displayName = 'Button';

export default Button;