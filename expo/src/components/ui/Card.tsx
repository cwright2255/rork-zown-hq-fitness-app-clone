import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  ViewProps,
} from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/tokens';

interface CardProps extends ViewProps {
  onPress?: () => void;
  elevated?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({
  onPress,
  elevated = false,
  accessibilityLabel,
  style,
  children,
  ...rest
}: CardProps) {
  const containerStyle = [
    styles.base,
    { backgroundColor: elevated ? Colors.surfaceElevated : Colors.surface },
    elevated && styles.shadow,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={containerStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={containerStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default Card;
