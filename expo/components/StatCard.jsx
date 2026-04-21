import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function StatCard({
  value,
  label,
  icon,
  accentColor,
  style,
  compact = false,
}) {
  return (
    <View
      style={[
        styles.container,
        compact && styles.compact,
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        style,
      ]}>
      {icon ? <View style={styles.iconTopRight}>{icon}</View> : null}
      <Text style={[typography.number, compact && typography.numberSmall, styles.value]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    minHeight: 96,
    justifyContent: 'center',
  },
  compact: {
    minHeight: 72,
    padding: spacing.md,
  },
  iconTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.8,
  },
  value: {
    marginBottom: 4,
  },
  label: {
    ...typography.caption,
    textTransform: 'uppercase',
  },
});
