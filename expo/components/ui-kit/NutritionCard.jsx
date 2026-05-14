/**
 * @fileoverview NutritionCard Component
 * @description A macro summary card displaying total calories as a center number
 * with three circular mini-rings showing protein, carbs, and fat progress.
 * Each ring includes a label, current value, and goal value.
 *
 * @component NutritionCard
 * @param {object} props
 * @param {number} props.calories - Total calories consumed
 * @param {number} props.calorieGoal - Total calorie goal
 * @param {number} props.protein - Grams of protein consumed
 * @param {number} props.proteinGoal - Protein goal in grams
 * @param {number} props.carbs - Grams of carbs consumed
 * @param {number} props.carbsGoal - Carbs goal in grams
 * @param {number} props.fat - Grams of fat consumed
 * @param {number} props.fatGoal - Fat goal in grams
 * @param {string} [props.title] - Optional card title
 * @param {string} [props.subtitle] - Optional card subtitle/date label
 *
 * @example
 * // Usage example:
 * import NutritionCard from './components/NutritionCard';
 *
 * <NutritionCard
 *   calories={1840}
 *   calorieGoal={2200}
 *   protein={142}
 *   proteinGoal={180}
 *   carbs={195}
 *   carbsGoal={240}
 *   fat={58}
 *   fatGoal={70}
 *   title="Today's Nutrition"
 *   subtitle="Monday, Jan 15"
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { tokens } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Mini Progress Ring
// ---------------------------------------------------------------------------

/**
 * MiniRing renders a small SVG circular progress ring.
 * @param {object} p
 * @param {number}  p.size        - Diameter of the ring in dp
 * @param {number}  p.strokeWidth - Thickness of the progress stroke
 * @param {number}  p.progress    - 0-1 fill fraction
 * @param {string}  p.color       - Active stroke color
 * @param {string}  p.trackColor  - Background track color
 */
const MiniRing = ({ size = 64, strokeWidth = 5, progress = 0, color, trackColor }) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = size / 2;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      {/* Track */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// MacroRingItem Ã¢ÂÂ ring + labels stacked
// ---------------------------------------------------------------------------

const MacroRingItem = ({ label, value, goal, color, trackColor }) => {
  const progress = goal > 0 ? value / goal : 0;
  const percentText = `${Math.round(progress * 100)}%`;

  return (
    <View style={styles.macroItem}>
      <View style={styles.ringWrapper}>
        <MiniRing
          size={72}
          strokeWidth={6}
          progress={progress}
          color={color}
          trackColor={trackColor}
        />
        {/* Center percent text inside ring */}
        <View style={styles.ringCenter}>
          <Text style={[styles.ringPercentText, { color }]}>{percentText}</Text>
        </View>
      </View>
      <Text style={styles.macroValue}>
        {value}
        <Text style={styles.macroUnit}>g</Text>
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroGoal}>of {goal}g</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// CalorieCenterDisplay
// ---------------------------------------------------------------------------

const CalorieCenterDisplay = ({ calories, calorieGoal }) => {
  const remaining = Math.max(calorieGoal - calories, 0);
  const progress = calorieGoal > 0 ? calories / calorieGoal : 0;
  const clampedProgress = Math.min(progress, 1);

  const outerSize = 140;
  const strokeWidth = 8;
  const radius = (outerSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = outerSize / 2;

  return (
    <View style={styles.calorieCenterContainer}>
      <Svg
        width={outerSize}
        height={outerSize}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Outer track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tokens.colors.ink.border || '#1E2435'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Orange arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tokens.colors.accent.orange}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>

      {/* Centered text overlay */}
      <View style={styles.calorieCenterOverlay}>
        <Text style={styles.calorieNumber}>{calories.toLocaleString()}</Text>
        <Text style={styles.calorieLabel}>kcal</Text>
        <View style={styles.calorieDivider} />
        <Text style={styles.calorieRemainingLabel}>remaining</Text>
        <Text style={styles.calorieRemainingValue}>{remaining.toLocaleString()}</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// NutritionCard (main export)
// ---------------------------------------------------------------------------

const NutritionCard = ({
  calories = 1840,
  calorieGoal = 2200,
  protein = 142,
  proteinGoal = 180,
  carbs = 195,
  carbsGoal = 240,
  fat = 58,
  fatGoal = 70,
  title = "Today's Nutrition",
  subtitle = 'Monday, Jan 15',
}) => {
  const macros = [
    {
      label: 'Protein',
      value: protein,
      goal: proteinGoal,
      color: tokens.colors.accent.cyan,
      trackColor: tokens.colors.accent.cyanDim || 'rgba(0,212,255,0.15)',
    },
    {
      label: 'Carbs',
      value: carbs,
      goal: carbsGoal,
      color: tokens.colors.accent.orange,
      trackColor: tokens.colors.accent.orangeDim || 'rgba(255,87,34,0.15)',
    },
    {
      label: 'Fat',
      value: fat,
      goal: fatGoal,
      color: tokens.colors.accent.purple || '#BF5AF2',
      trackColor: 'rgba(191,90,242,0.15)',
    },
  ];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Daily</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.headerDivider} />

      {/* Body: calorie ring + macro rings */}
      <View style={styles.body}>
        {/* Left: calorie center ring */}
        <CalorieCenterDisplay calories={calories} calorieGoal={calorieGoal} />

        {/* Right: macro rings stacked */}
        <View style={styles.macrosColumn}>
          {macros.map((macro) => (
            <MacroRingItem
              key={macro.label}
              label={macro.label}
              value={macro.value}
              goal={macro.goal}
              color={macro.color}
              trackColor={macro.trackColor}
            />
          ))}
        </View>
      </View>

      {/* Footer: calorie breakdown bar */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Calorie breakdown</Text>
        <View style={styles.breakdownBar}>
          {(() => {
            const totalCals = protein * 4 + carbs * 4 + fat * 9;
            const pPct = totalCals > 0 ? (protein * 4) / totalCals : 0;
            const cPct = totalCals > 0 ? (carbs * 4) / totalCals : 0;
            const fPct = totalCals > 0 ? (fat * 9) / totalCals : 0;
            return (
              <>
                <View
                  style={[
                    styles.barSegment,
                    { flex: pPct, backgroundColor: tokens.colors.accent.cyan, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
                  ]}
                />
                <View style={[styles.barSegment, { flex: cPct, backgroundColor: tokens.colors.accent.orange }]} />
                <View
                  style={[
                    styles.barSegment,
                    { flex: fPct, backgroundColor: tokens.colors.accent.purple || '#BF5AF2', borderTopRightRadius: 4, borderBottomRightRadius: 4 },
                  ]}
                />
              </>
            );
          })()}
        </View>
        <View style={styles.breakdownLegend}>
          <LegendDot color={tokens.colors.accent.cyan} label={`Protein ${Math.round((protein * 4) / (protein * 4 + carbs * 4 + fat * 9) * 100)}%`} />
          <LegendDot color={tokens.colors.accent.orange} label={`Carbs ${Math.round((carbs * 4) / (protein * 4 + carbs * 4 + fat * 9) * 100)}%`} />
          <LegendDot color={tokens.colors.accent.purple || '#BF5AF2'} label={`Fat ${Math.round((fat * 9) / (protein * 4 + carbs * 4 + fat * 9) * 100)}%`} />
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// LegendDot helper
// ---------------------------------------------------------------------------

const LegendDot = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ---- Card ----
  card: {
    backgroundColor: tokens.colors.ink.darker,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.lg,
    marginHorizontal: tokens.spacing.lg,
    marginVertical: tokens.spacing.sm,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.colors.text.muted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  badge: {
    backgroundColor: 'rgba(255,87,34,0.15)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,87,34,0.3)',
  },
  badgeText: {
    color: tokens.colors.accent.orange,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: tokens.spacing.lg,
  },

  // ---- Body ----
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ---- Calorie center ----
  calorieCenterContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieCenterOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: tokens.colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  calorieLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  calorieDivider: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 5,
  },
  calorieRemainingLabel: {
    fontSize: 9,
    color: tokens.colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  calorieRemainingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.accent.orange,
    marginTop: 1,
  },

  // ---- Macros column ----
  macrosColumn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginLeft: tokens.spacing.md,
  },
  macroItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrapper: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercentText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  macroUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.colors.text.muted,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.text.secondary,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  macroGoal: {
    fontSize: 10,
    color: tokens.colors.text.muted,
    marginTop: 1,
  },

  // ---- Footer ----
  footer: {
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.sm,
  },
  breakdownBar: {
    height: 8,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: tokens.colors.ink.border || '#1E2435',
  },
  barSegment: {
    height: '100%',
  },
  breakdownLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: tokens.colors.text.muted,
    fontWeight: '500',
  },
});

export default NutritionCard;
