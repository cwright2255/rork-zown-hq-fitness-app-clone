import React from 'react';
import {
import { tokens } from '../../../../theme/tokens';
  StyleSheet,
  TouchableOpacity,
  View } from


'react-native';
import { Colors, Radius, Spacing } from '../../constants/tokens';

export function Card({
  onPress,
  elevated = false,
  accessibilityLabel,
  style,
  children,
  ...rest
}) {
  const containerStyle = [
  styles.base,
  { backgroundColor: elevated ? Colors.surfaceElevated : Colors.surface },
  elevated && styles.shadow,
  style];


  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={containerStyle}>
        
        {children}
      </TouchableOpacity>);

  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={containerStyle} {...rest}>
      {children}
    </View>);

}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  shadow: {
    shadowColor: tokens.colors.grayscale.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  }
});

export default Card;