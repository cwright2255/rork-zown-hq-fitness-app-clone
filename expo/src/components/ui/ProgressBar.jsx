import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../constants/tokens';

const colorMap = {
  primary: Colors.primary,
  accent: Colors.accent,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
};

export function ProgressBar({
  value,
  min = 0,
  max = 100,
  variant = 'primary',
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = max === min ? 0 : ((clamped - min) / (max - min)) * 100;
  const width = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [pct, width]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: clamped }}
      style={[styles.track, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: colorMap[variant],
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});

export default ProgressBar;
