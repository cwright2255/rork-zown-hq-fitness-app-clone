// components/ReadinessCard.jsx
//
// Today's readiness (lib/readiness.js) with the working shown: the number and its band, then a row for each of the four things it is
// made from with what was read, how that scored and how much it counts for, and the formula in words. Before there is enough to work a
// score out it shows the same rows and says what is missing, so nobody is left guessing why there is no number. With no readings at all
// it shows nothing. Everything it shows comes from computeReadiness(); it works nothing out itself.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';

// A dot beside the word for the band, so the colour is never the only thing that says it.
const BAND_DOT = { High: '#22C55E', Moderate: '#D97706', Low: '#DC2626' };
const DASH = '\u2014';

export const NOT_READY_TEXT = 'Readiness appears once two of HRV, resting heart rate and sleep have a reading today, and HRV and resting heart rate '
  + 'have about two weeks of earlier readings to compare with.';

export default function ReadinessCard({ readiness }) {
  if (!readiness || readiness.hidden) return null;
  const { ready, score, label, used, parts, formula } = readiness;

  return (
    <View testID="readiness-card" style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="pulse-outline" size={20} color={colors.text} />
        <Text style={styles.title}>Readiness</Text>
      </View>

      {ready ? (
        <View accessible accessibilityLabel={`Readiness ${score} out of 100, ${label}`} style={styles.scoreRow}>
          <Text testID="readiness-score" style={styles.score}>{String(score)}</Text>
          <View style={styles.scoreSide}>
            <View style={styles.labelRow}>
              <View testID="readiness-dot" style={[styles.dot, { backgroundColor: BAND_DOT[label] }]} />
              <Text testID="readiness-label" style={styles.label}>{label}</Text>
            </View>
            <Text testID="readiness-basis" style={styles.sub}>{`Out of 100, made from ${used} of 4 readings`}</Text>
          </View>
        </View>
      ) : (
        <Text testID="readiness-not-ready" style={styles.sub}>{NOT_READY_TEXT}</Text>
      )}

      <View style={styles.rows}>
        {parts.map((part) => (
          <View key={part.key} testID={`readiness-row-${part.key}`} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{part.title}</Text>
              <Text testID={`readiness-detail-${part.key}`} style={styles.rowDetail}>{part.detail}</Text>
            </View>
            <View style={styles.rowSide}>
              <Text testID={`readiness-part-score-${part.key}`} style={styles.rowScore}>{part.state === 'used' ? String(part.score) : DASH}</Text>
              {part.state === 'used' ? (
                <Text testID={`readiness-weight-${part.key}`} style={styles.rowWeight}>{`x${part.weight}`}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Text testID="readiness-formula" style={styles.formula}>{formula}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.base, marginHorizontal: spacing.base, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  score: { fontSize: 44, fontWeight: '800', color: colors.text },
  scoreSide: { flex: 1, marginLeft: spacing.base },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rows: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMain: { flex: 1, paddingRight: spacing.sm },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowSide: { alignItems: 'flex-end', minWidth: 40 },
  rowScore: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowWeight: { fontSize: 11, color: colors.textSecondary },
  formula: { fontSize: 11, lineHeight: 16, color: colors.textSecondary, marginTop: spacing.sm },
});
