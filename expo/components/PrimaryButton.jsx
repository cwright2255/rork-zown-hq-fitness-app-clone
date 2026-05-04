import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, radius, typography } from '@/constants/theme';
import { tokens } from '../../theme/tokens';

export default function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  fullWidth = true,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    fullWidth && styles.fullWidth,
    variantStyles[variant]?.container,
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variantStyles[variant]?.label,
    textStyle,
  ];

  const indicatorColor = variant === 'primary' ? '#000' : '#fff';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={containerStyle}>
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text style={labelStyle}>{title}</Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    marginHorizontal: 2,
  },
  label: {
    ...typography.button,
  },
  disabled: {
    opacity: 0.4,
  },
});

const variantStyles = {
  primary: {
    container: { backgroundColor: colors.text },
    label: { color: tokens.colors.grayscale.black },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.text,
    },
    label: { color: colors.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: colors.text },
  },
  danger: {
    container: { backgroundColor: colors.red },
    label: { color: tokens.colors.background.default },
  },
  spotify: {
    container: { backgroundColor: colors.spotify },
    label: { color: tokens.colors.background.default },
  },
  dark: {
    container: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: { color: colors.text },
  },
};
