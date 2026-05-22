/**
 * @fileoverview WorkoutCard Component
 * @description A polished workout summary card for the Fitleus fitness app.
 * Displays workout icon area, title, duration, calories burned, and an optional
 * animated progress bar. Designed for the dark Fitleus theme.
 *
 * @component WorkoutCard
 * @param {object} props
 * @param {string} [props.title='Morning Run'] - Workout title
 * @param {string} [props.subtitle='Cardio'] - Workout category/subtitle
 * @param {number} [props.duration=45] - Duration in minutes
 * @param {number} [props.calories=320] - Calories burned
 * @param {number} [props.progress=0.65] - Progress value between 0 and 1
 * @param {boolean} [props.showProgress=true] - Whether to show the progress bar
 * @param {string} [props.accentColor] - Override accent color
 * @param {string} [props.iconEmoji='Ã°ÂÂÂ'] - Emoji used in the icon area
 * @param {boolean} [props.isActive=false] - Highlights card if workout is active
 * @param {function} [props.onPress] - Callback when card is pressed
 *
 * @example
 * // Basic usage
 * <WorkoutCard
 *   title="Morning Run"
 *   subtitle="Cardio"
 *   duration={45}
 *   calories={320}
 *   progress={0.65}
 *   showProgress={true}
 *   iconEmoji="Ã°ÂÂÂ"
 *   onPress={() => console.log('Card pressed')}
 * />
 *
 * // Active workout
 * <WorkoutCard
 *   title="HIIT Training"
 *   subtitle="Strength"
 *   duration={30}
 *   calories={410}
 *   progress={0.4}
 *   isActive={true}
 *   iconEmoji="Ã¢ÂÂ¡"
 *   accentColor="#00D4FF"
 * />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { tokens } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Fallback tokens in case the import path isn't resolved in isolation
// ---------------------------------------------------------------------------
const COLORS = {
  background: tokens?.colors?.ink?.darkest ?? '#0A0E1A',
  card: tokens?.colors?.ink?.darker ?? '#141824',
  accent: '#FF5722',
  cyan: '#00D4FF',
  white: '#FFFFFF',
  mutedGray: '#8A94A6',
  border: '#1E2535',
  progressTrack: '#1E2535',
};

const SPACING = {
  xs: tokens?.spacing?.xs ?? 4,
  sm: tokens?.spacing?.sm ?? 8,
  md: tokens?.spacing?.md ?? 12,
  lg: tokens?.spacing?.lg ?? 16,
  xl: tokens?.spacing?.xl ?? 24,
};

const RADIUS = {
  sm: tokens?.radius?.sm ?? 4,
  md: tokens?.radius?.md ?? 8,
  lg: tokens?.radius?.lg ?? 12,
  xl: tokens?.radius?.xl ?? 16,
};

// ---------------------------------------------------------------------------
// StatPill Ã¢ÂÂ small metric display (duration / calories)
// ---------------------------------------------------------------------------
const StatPill = ({ label, value, unit, color }) => (
  <View style={styles.statPill}>
    <Text style={[styles.statValue, { color: color ?? COLORS.white }]}>
      {value}
      <Text style={styles.statUnit}> {unit}</Text>
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// AnimatedProgressBar
// ---------------------------------------------------------------------------
const AnimatedProgressBar = ({ progress, color }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(Math.max(progress, 0), 1),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: color ?? COLORS.accent,
            width: animatedWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
      <View
        style={[
          styles.progressGlow,
          { backgroundColor: color ?? COLORS.accent },
        ]}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// WorkoutCard
// ---------------------------------------------------------------------------
const WorkoutCard = ({
  title = 'Morning Run',
  subtitle = 'Cardio',
  duration = 45,
  calories = 320,
  progress = 0.65,
  showProgress = true,
  accentColor,
  iconEmoji = 'Ã°ÂÂÂ',
  isActive = false,
  onPress,
}) => {
  const resolvedAccent = accentColor ?? COLORS.accent;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const progressPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${title} workout, ${duration} minutes, ${calories} calories`}
    >
      <Animated.View
        style={[
          styles.card,
          isActive && [
            styles.cardActive,
            { borderColor: resolvedAccent + '55' },
          ],
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Active badge */}
        {isActive && (
          <View style={[styles.activeBadge, { backgroundColor: resolvedAccent }]}>
            <Text style={styles.activeBadgeText}>ACTIVE</Text>
          </View>
        )}

        {/* Top row: icon + title block + accent dot */}
        <View style={styles.topRow}>
          {/* Icon area */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: resolvedAccent + '22' },
            ]}
          >
            <Text style={styles.iconEmoji}>{iconEmoji}</Text>
            {/* Subtle inner glow ring */}
            <View
              style={[
                styles.iconRing,
                { borderColor: resolvedAccent + '44' },
              ]}
            />
          </View>

          {/* Title & subtitle */}
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.subtitleRow}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: resolvedAccent },
                ]}
              />
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <Text style={[styles.chevron, { color: COLORS.mutedGray }]}>Ã¢ÂÂº</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            label="Duration"
            value={duration}
            unit="min"
            color={resolvedAccent}
          />
          <View style={styles.statDivider} />
          <StatPill
            label="Calories"
            value={calories}
            unit="kcal"
            color={COLORS.cyan}
          />
          {showProgress && (
            <>
              <View style={styles.statDivider} />
              <StatPill
                label="Progress"
                value={progressPercent}
                unit="%"
                color={COLORS.white}
              />
            </>
          )}
        </View>

        {/* Progress bar */}
        {showProgress && (
          <View style={styles.progressSection}>
            <AnimatedProgressBar
              progress={progress}
              color={resolvedAccent}
            />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  cardActive: {
    borderWidth: 1.5,
  },

  // ---- Active badge ----
  activeBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: RADIUS.sm,
    zIndex: 10,
  },
  activeBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // ---- Top row ----
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  // ---- Icon ----
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    position: 'relative',
  },
  iconEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  iconRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },

  // ---- Title block ----
  titleBlock: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: SPACING.xs,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  subtitle: {
    color: COLORS.mutedGray,
    fontSize: 13,
    fontWeight: '500',
  },

  // ---- Chevron ----
  chevronContainer: {
    marginLeft: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },

  // ---- Divider ----
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },

  // ---- Stats ----
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.mutedGray,
  },
  statLabel: {
    color: COLORS.mutedGray,
    fontSize: 11,
    fontWeight: '500',
    marginTop: SPACING.xs / 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },

  // ---- Progress ----
  progressSection: {
    marginTop: SPACING.xs,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.progressTrack,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
  },
  progressGlow: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 12,
    height: '100%',
    opacity: 0.5,
    borderRadius: RADIUS.sm,
  },
});

export default WorkoutCard;
