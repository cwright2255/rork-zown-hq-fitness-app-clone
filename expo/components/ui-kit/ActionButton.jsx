/**
 * @component ActionButton
 * @description Primary CTA pill button for the Fitleus fitness app.
 * Full-width, rounded, orange-red accent fill with optional loading and disabled states.
 *
 * @prop {string} title - Button label text
 * @prop {Function} onPress - Callback fired when button is pressed
 * @prop {boolean} [loading=false] - Shows an activity indicator when true
 * @prop {boolean} [disabled=false] - Disables interaction and dims the button when true
 *
 * @example
 * // Basic usage
 * <ActionButton title="Start Workout" onPress={() => console.log('pressed')} />
 *
 * // Loading state
 * <ActionButton title="Saving..." onPress={handleSave} loading={true} />
 *
 * // Disabled state
 * <ActionButton title="Complete" onPress={handleComplete} disabled={true} />
 */

import React, { useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tokens } from '../../theme/tokens';

const ActionButton = ({
  title = 'Get Started',
  onPress = () => {},
  loading = false,
  disabled = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const isInteractionDisabled = disabled || loading;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={isInteractionDisabled ? undefined : onPress}
        onPressIn={isInteractionDisabled ? undefined : handlePressIn}
        onPressOut={isInteractionDisabled ? undefined : handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isInteractionDisabled, busy: loading }}
        style={[
          styles.button,
          isInteractionDisabled && styles.buttonDisabled,
        ]}
      >
        {/* Gradient-like inner highlight overlay */}
        <View style={styles.innerHighlight} pointerEvents="none" />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="small"
              color={tokens.colors.white}
              style={styles.activityIndicator}
            />
            <Text style={[styles.label, styles.labelLoading]}>
              {title}
            </Text>
          </View>
        ) : (
          <Text style={styles.label}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    // Shadow for iOS
    shadowColor: tokens.colors.accent.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    // Shadow for Android
    elevation: 10,
    borderRadius: 50,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accent.orange,
    borderRadius: 50,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    overflow: 'hidden',
    minHeight: 56,
  },
  buttonDisabled: {
    opacity: 0.45,
    // Suppress shadow when disabled
    shadowOpacity: 0,
    elevation: 0,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIndicator: {
    marginRight: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  labelLoading: {
    opacity: 0.85,
  },
});

export default ActionButton;
