import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants/tokens';

const variantStyles = {
  primary: {
    container: { backgroundColor: Colors.primary },
    label: { color: Colors.text.primary },
  },
  secondary: {
    container: { backgroundColor: Colors.surfaceElevated },
    label: { color: Colors.text.primary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: Colors.primary },
  },
  danger: {
    container: { backgroundColor: Colors.error },
    label: { color: Colors.text.primary },
  },
};

const sizeStyles = {
  sm: {
    container: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    label: { fontSize: Typography.size.sm },
  },
  md: {
    container: { paddingVertical: Spacing.md - 4, paddingHorizontal: Spacing.lg },
    label: { fontSize: Typography.size.base },
  },
  lg: {
    container: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
    label: { fontSize: Typography.size.lg },
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        variantStyles[variant].container,
        sizeStyles[size].container,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].label.color} />
      ) : (
        <Text
          style={[
            styles.labelBase,
            variantStyles[variant].label,
            sizeStyles[size].label,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: { opacity: 0.5 },
  labelBase: {
    fontWeight: Typography.weight.semibold,
  },
});

export default Button;
