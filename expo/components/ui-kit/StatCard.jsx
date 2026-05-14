/**
 * @file StatCard.jsx
 * @description A polished numeric stat card component for the Fitleus fitness app.
 * Displays a key metric with a label, numeric value, optional icon placeholder,
 * and an optional trend indicator showing change over time.
 *
 * @component StatCard
 * @prop {string} label - The descriptive label for the stat (e.g., "Steps Today")
 * @prop {string|number} value - The primary numeric or text value to display
 * @prop {string} [unit] - Optional unit string appended to value (e.g., "kcal", "bpm")
 * @prop {number} [trend] - Optional numeric trend value (positive = up, negative = down)
 * @prop {string} [trendLabel] - Optional label for the trend (e.g., "vs yesterday")
 * @prop {string} [accentColor] - Override accent color for icon/value highlight
 * @prop {React.ReactNode} [icon] - Optional icon element; renders a placeholder if omitted
 * @prop {boolean} [compact] - If true, renders a smaller compact version
 * @prop {object} [style] - Additional style overrides for the card container
 *
 * @example
 * // Basic usage
 * <StatCard
 *   label="Calories Burned"
 *   value="1,284"
 *   unit="kcal"
 *   trend={12.4}
 *   trendLabel="vs yesterday"
 * />
 *
 * // Compact with custom accent
 * <StatCard
 *   label="Heart Rate"
 *   value="78"
 *   unit="bpm"
 *   accentColor="#FF5722"
 *   compact
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { tokens } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Fallback tokens in case the import is unavailable in isolation
// ---------------------------------------------------------------------------
const fallbackTokens = {
  colors: {
    ink: {
      darkest: '#0A0E1A',
      darker: '#141824',
      dark: '#1E2435',
      mid: '#2A3147',
    },
    accent: {
      orange: '#FF5722',
      cyan: '#00D4FF',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8A94A6',
      muted: '#4A5568',
    },
    status: {
      success: '#00C896',
      danger: '#FF4757',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    size: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 20,
      xxl: 28,
      xxxl: 36,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
};

// Safely resolve tokens with fallback
const resolvedTokens = (typeof tokens !== 'undefined' && tokens) ? tokens : fallbackTokens;
const C = resolvedTokens.colors || fallbackTokens.colors;
const S = resolvedTokens.spacing || fallbackTokens.spacing;
const R = resolvedTokens.radius || fallbackTokens.radius;
const T = resolvedTokens.typography || fallbackTokens.typography;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * TrendBadge Ã¢ÂÂ shows an arrow + percentage for positive/negative trends
 */
const TrendBadge = ({ trend, trendLabel }) => {
  if (trend === null || trend === undefined) return null;

  const isPositive = trend >= 0;
  const trendColor = isPositive
    ? (C.status?.success || fallbackTokens.colors.status.success)
    : (C.status?.danger || fallbackTokens.colors.status.danger);
  const arrow = isPositive ? 'Ã¢ÂÂ²' : 'Ã¢ÂÂ¼';
  const absValue = Math.abs(trend).toFixed(1);

  return (
    <View style={trendStyles.container}>
      <View style={[trendStyles.badge, { backgroundColor: trendColor + '22' }]}>
        <Text style={[trendStyles.arrow, { color: trendColor }]}>{arrow}</Text>
        <Text style={[trendStyles.value, { color: trendColor }]}>
          {absValue}%
        </Text>
      </View>
      {trendLabel ? (
        <Text style={trendStyles.label} numberOfLines={1}>
          {trendLabel}
        </Text>
      ) : null}
    </View>
  );
};

const trendStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: S.xs,
    flexWrap: 'wrap',
    gap: S.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: 2,
    borderRadius: R.full || 9999,
  },
  arrow: {
    fontSize: T.size?.xs || 10,
    marginRight: 2,
    fontWeight: T.weight?.bold || '700',
  },
  value: {
    fontSize: T.size?.xs || 10,
    fontWeight: T.weight?.semibold || '600',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: T.size?.xs || 10,
    color: C.text?.secondary || fallbackTokens.colors.text.secondary,
    fontWeight: T.weight?.regular || '400',
  },
});

/**
 * IconPlaceholder Ã¢ÂÂ renders a colored rounded square as an icon placeholder
 */
const IconPlaceholder = ({ accentColor, compact }) => {
  const size = compact ? 32 : 40;
  const iconSize = compact ? 16 : 20;
  return (
    <View
      style={[
        iconStyles.container,
        {
          width: size,
          height: size,
          borderRadius: R.md || 8,
          backgroundColor: accentColor + '22',
        },
      ]}
    >
      {/* Simple geometric icon placeholder Ã¢ÂÂ three stacked lines */}
      <View style={iconStyles.iconInner}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              iconStyles.line,
              {
                width: iconSize - i * 4,
                backgroundColor: accentColor,
                opacity: 1 - i * 0.2,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const iconStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    gap: 3,
    alignItems: 'flex-start',
  },
  line: {
    height: 2,
    borderRadius: 1,
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const StatCard = ({
  label = 'Steps Today',
  value = '8,432',
  unit = 'steps',
  trend = 5.2,
  trendLabel = 'vs yesterday',
  accentColor,
  icon,
  compact = false,
  style,
}) => {
  const resolvedAccent = accentColor || (C.accent?.cyan || fallbackTokens.colors.accent.cyan);

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        style,
      ]}
    >
      {/* Top row: icon + label */}
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          {icon ? (
            <View style={[styles.iconWrapper, compact && styles.iconWrapperCompact]}>
              {icon}
            </View>
          ) : (
            <IconPlaceholder accentColor={resolvedAccent} compact={compact} />
          )}
          <Text
            style={[styles.label, compact && styles.labelCompact]}
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>

        {/* Subtle accent dot indicator */}
        <View
          style={[
            styles.accentDot,
            { backgroundColor: resolvedAccent },
          ]}
        />
      </View>

      {/* Value row */}
      <View style={[styles.valueRow, compact && styles.valueRowCompact]}>
        <Text
          style={[
            styles.value,
            compact && styles.valueCompact,
            { color: C.text?.primary || '#FFFFFF' },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={[
              styles.unit,
              compact && styles.unitCompact,
              { color: resolvedAccent },
            ]}
          >
            {' '}{unit}
          </Text>
        ) : null}
      </View>

      {/* Trend indicator */}
      {!compact && (
        <TrendBadge trend={trend} trendLabel={trendLabel} />
      )}

      {/* Bottom accent bar */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: resolvedAccent },
        ]}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.ink?.darker || fallbackTokens.colors.ink.darker,
    borderRadius: R.xl || 16,
    padding: S.lg || 16,
    paddingBottom: S.md || 12,
    overflow: 'hidden',
    // Border
    borderWidth: 1,
    borderColor: (C.ink?.mid || fallbackTokens.colors.ink.mid) + '88',
    // Shadows
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
    minWidth: 160,
    position: 'relative',
  },

  cardCompact: {
    padding: S.md || 12,
    paddingBottom: S.sm || 8,
    minWidth: 120,
    borderRadius: R.lg || 12,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: S.md || 12,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: S.sm || 8,
    paddingRight: S.sm || 8,
  },

  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: R.md || 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: (C.ink?.dark || fallbackTokens.colors.ink.dark),
    flexShrink: 0,
  },

  iconWrapperCompact: {
    width: 32,
    height: 32,
  },

  label: {
    fontSize: T.size?.sm || 12,
    fontWeight: T.weight?.medium || '500',
    color: C.text?.secondary || fallbackTokens.colors.text.secondary,
    letterSpacing: 0.3,
    flex: 1,
    lineHeight: 16,
  },

  labelCompact: {
    fontSize: T.size?.xs || 10,
  },

  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
    opacity: 0.85,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: S.xs || 4,
  },

  valueRowCompact: {
    marginBottom: S.xs || 4,
  },

  value: {
    fontSize: T.size?.xxl || 28,
    fontWeight: T.weight?.bold || '700',
    letterSpacing: -0.5,
    includeFontPadding: false,
  },

  valueCompact: {
    fontSize: T.size?.xl || 20,
  },

  unit: {
    fontSize: T.size?.sm || 12,
    fontWeight: T.weight?.semibold || '600',
    letterSpacing: 0.5,
    marginLeft: 2,
    paddingBottom: 2,
  },

  unitCompact: {
    fontSize: T.size?.xs || 10,
  },

  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
});

export default StatCard;
