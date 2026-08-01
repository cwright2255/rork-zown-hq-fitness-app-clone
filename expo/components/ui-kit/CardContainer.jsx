/**
 * @component CardContainer
 * @description Generic dark rounded card wrapper for the Fitleus fitness app UI kit.
 * Renders children inside a consistently styled dark card with padding, border-radius,
 * and optional shadow. Supports optional title, subtitle, and accent indicator.
 *
 * @prop {React.ReactNode} children - Content to render inside the card
 * @prop {string} [title] - Optional card title displayed at the top
 * @prop {string} [subtitle] - Optional subtitle displayed below the title
 * @prop {string} [accentColor] - Optional accent color for the left border indicator (default: orange)
 * @prop {boolean} [showAccent=false] - Whether to show the left accent border
 * @prop {object} [style] - Optional additional styles for the card container
 * @prop {object} [contentStyle] - Optional additional styles for the inner content wrapper
 * @prop {boolean} [elevated=true] - Whether to apply shadow elevation
 * @prop {function} [onPress] - Optional press handler; wraps card in TouchableOpacity if provided
 *
 * @example
 * // Basic usage:
 * <CardContainer title="Today's Workout" subtitle="Upper Body" showAccent accentColor="#FF5722">
 *   <Text style={{ color: '#FFFFFF' }}>Bench Press - 4x10</Text>
 *   <Text style={{ color: '#FFFFFF' }}>Shoulder Press - 3x12</Text>
 * </CardContainer>
 *
 * @example
 * // As a pressable card:
 * <CardContainer onPress={() => navigation.navigate('WorkoutDetail')} elevated>
 *   <WorkoutSummary data={workoutData} />
 * </CardContainer>
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { tokens } from '../../theme/tokens';

const CardContainer = ({
  children,
  title,
  subtitle,
  accentColor = tokens.colors.accent?.orange ?? '#FF5722',
  showAccent = false,
  style,
  contentStyle,
  elevated = true,
  onPress,
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, activeOpacity: 0.82 }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.card,
        elevated && styles.elevated,
        showAccent && styles.accentBorder,
        showAccent && { borderLeftColor: accentColor },
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={styles.header}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor:
      (tokens.colors?.ink?.darker) ?? '#141824',
    borderRadius:
      (tokens.radius?.lg) ?? 12,
    padding:
      (tokens.spacing?.lg) ?? 16,
    marginVertical:
      (tokens.spacing?.sm) ?? 8,
    overflow: 'hidden',
  },
  elevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  accentBorder: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF5722',
  },
  header: {
    marginBottom:
      (tokens.spacing?.md) ?? 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom:
      (tokens.spacing?.xs) ?? 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color:
      (tokens.colors?.text?.muted) ??
      (tokens.colors?.ink?.muted) ??
      '#8A8FA8',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  content: {
    flexDirection: 'column',
  },
});

export default CardContainer;
