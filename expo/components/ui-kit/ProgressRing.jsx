/**
 * @component ProgressRing
 * @description A circular progress indicator component for the Fitleus fitness app.
 * Renders an animated SVG ring with a percentage label in the center, an optional
 * title and subtitle, and supports accent color theming.
 *
 * @prop {number} progress - Value between 0 and 100 representing completion percentage.
 * @prop {number} [size=160] - Diameter of the ring in pixels.
 * @prop {number} [strokeWidth=12] - Thickness of the progress arc.
 * @prop {string} [color] - Color of the progress arc. Defaults to accent orange.
 * @prop {string} [trackColor] - Color of the background track ring.
 * @prop {string} [label] - Optional title label rendered below the percentage.
 * @prop {string} [sublabel] - Optional subtitle rendered below the label.
 * @prop {boolean} [showCard=true] - Wrap the ring in a styled dark card.
 * @prop {React.ReactNode} [centerContent] - Override the center label content.
 *
 * @example
 * // Basic usage:
 * <ProgressRing progress={72} label="Calories" sublabel="1,440 / 2,000 kcal" />
 *
 * // Custom color and size:
 * <ProgressRing
 *   progress={55}
 *   size={120}
 *   strokeWidth={10}
 *   color="#00D4FF"
 *   label="Hydration"
 *   sublabel="1.1 / 2.0 L"
 * />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { tokens } from '../../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ProgressRing = ({
  progress = 68,
  size = 160,
  strokeWidth = 12,
  color = tokens.colors.accent.orange ?? '#FF5722',
  trackColor,
  label = 'Overall Progress',
  sublabel = 'Keep it up!',
  showCard = true,
  centerContent,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedProgress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, circumference - (circumference * clampedProgress) / 100],
  });

  const resolvedTrackColor =
    trackColor ??
    (tokens.colors?.ink?.dark ?? '#1E2336');

  const accentColor = color;

  // Determine gradient id
  const gradientId = 'progressGradient';

  const cx = size / 2;
  const cy = size / 2;

  const defaultCenterContent = (
    <View style={styles.centerContent}>
      <Text style={[styles.percentageText, { color: accentColor }]}>
        {clampedProgress}%
      </Text>
      {label ? (
        <Text style={styles.centerLabel} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );

  const ringNode = (
    <View style={[styles.ringWrapper, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={tokens.colors?.accent?.cyan ?? '#00D4FF'} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={resolvedTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      {/* Center overlay */}
      <View
        style={[
          styles.centerOverlay,
          { width: size, height: size },
        ]}
        pointerEvents="none"
      >
        {centerContent ?? defaultCenterContent}
      </View>
    </View>
  );

  if (!showCard) {
    return (
      <View style={styles.noCardContainer}>
        {ringNode}
        {sublabel ? (
          <Text style={styles.sublabel}>{sublabel}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
        <Text style={styles.cardTitle}>{label}</Text>
      </View>

      {/* Ring */}
      <View style={styles.ringContainer}>
        {ringNode}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatPill
          icon="Ã°ÂÂÂ¥"
          value={`${clampedProgress}%`}
          desc="Achieved"
          accentColor={accentColor}
        />
        <View style={styles.statDivider} />
        <StatPill
          icon="Ã°ÂÂÂ¯"
          value={`${100 - clampedProgress}%`}
          desc="Remaining"
          accentColor={tokens.colors?.accent?.cyan ?? '#00D4FF'}
        />
      </View>

      {/* Sublabel */}
      {sublabel ? (
        <Text style={styles.sublabel}>{sublabel}</Text>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

const StatPill = ({ icon, value, desc, accentColor }) => (
  <View style={styles.statPill}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
    <Text style={styles.statDesc}>{desc}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors?.ink?.darker ?? '#141824',
    borderRadius: tokens.radius?.xl ?? 16,
    padding: tokens.spacing?.lg ?? 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: tokens.spacing?.lg ?? 16,
  },

  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: tokens.spacing?.sm ?? 8,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors?.white ?? '#FFFFFF',
    letterSpacing: 0.3,
  },

  ringContainer: {
    marginVertical: tokens.spacing?.md ?? 12,
  },

  ringWrapper: {
    position: 'relative',
  },

  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing?.sm ?? 8,
  },

  percentageText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 38,
  },

  centerLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.colors?.ink?.muted ?? '#8A91A8',
    marginTop: 2,
    textAlign: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing?.md ?? 12,
    width: '100%',
    backgroundColor: tokens.colors?.ink?.darkest ?? '#0A0E1A',
    borderRadius: tokens.radius?.lg ?? 12,
    paddingVertical: tokens.spacing?.sm ?? 8,
    paddingHorizontal: tokens.spacing?.lg ?? 16,
  },

  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: tokens.colors?.ink?.dark ?? '#1E2336',
    marginHorizontal: tokens.spacing?.md ?? 12,
  },

  statPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIcon: {
    fontSize: 16,
    marginBottom: 2,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  statDesc: {
    fontSize: 11,
    color: tokens.colors?.ink?.muted ?? '#8A91A8',
    marginTop: 1,
    fontWeight: '500',
  },

  sublabel: {
    fontSize: 12,
    color: tokens.colors?.ink?.muted ?? '#8A91A8',
    marginTop: tokens.spacing?.sm ?? 8,
    textAlign: 'center',
    fontWeight: '400',
  },

  noCardContainer: {
    alignItems: 'center',
  },
});

export default ProgressRing;
