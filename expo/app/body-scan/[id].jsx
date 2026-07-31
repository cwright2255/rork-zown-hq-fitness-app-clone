import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { tokens } from '../../../theme/tokens';

export default function BodyScanDetailScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>3D Body Scan Analysis</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3D Body Mesh & Composition</Text>
        <Text style={styles.cardText}>Interactive 3D Body Mesh viewer and metrics visualization panel.</Text>
      </View>
      <View style={styles.metricsContainer}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Body Fat %</Text>
          <Text style={styles.metricValue}>18.5%</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Lean Mass</Text>
          <Text style={styles.metricValue}>68.2 kg</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Muscle Mass</Text>
          <Text style={styles.metricValue}>35.4 kg</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background || '#121212',
  },
  content: {
    padding: tokens.spacing.lg || 16,
  },
  title: {
    fontSize: tokens.fontSize.xxl || 24,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary || '#FFFFFF',
    marginBottom: tokens.spacing.md || 12,
  },
  card: {
    backgroundColor: tokens.colors.surface || '#1E1E1E',
    borderRadius: tokens.borderRadius.lg || 12,
    padding: tokens.spacing.md || 16,
    marginBottom: tokens.spacing.md || 16,
  },
  cardTitle: {
    fontSize: tokens.fontSize.lg || 18,
    fontWeight: '600',
    color: tokens.colors.textPrimary || '#FFFFFF',
    marginBottom: tokens.spacing.xs || 4,
  },
  cardText: {
    fontSize: tokens.fontSize.sm || 14,
    color: tokens.colors.textSecondary || '#AAAAAA',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs || 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: tokens.colors.surface || '#1E1E1E',
    borderRadius: tokens.borderRadius.md || 8,
    padding: tokens.spacing.sm || 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: tokens.fontSize.xs || 12,
    color: tokens.colors.textSecondary || '#AAAAAA',
    marginBottom: tokens.spacing.xs || 4,
  },
  metricValue: {
    fontSize: tokens.fontSize.md || 16,
    fontWeight: 'bold',
    color: tokens.colors.primary || '#FF5500',
  },
});
