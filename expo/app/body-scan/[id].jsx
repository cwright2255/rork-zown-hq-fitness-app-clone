import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { tokens } from '../../theme/tokens';

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
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>BMR</Text>
          <Text style={styles.metricValue}>1,780 kcal</Text>
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
    fontSize: tokens.fontSize.xl || 22,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary || '#FFFFFF',
    marginBottom: tokens.spacing.md || 12,
  },
  card: {
    backgroundColor: tokens.colors.cardBackground || '#1E1E1E',
    borderRadius: 12,
    padding: tokens.spacing.md || 16,
    marginBottom: tokens.spacing.md || 16,
  },
  cardTitle: {
    fontSize: tokens.fontSize.lg || 18,
    fontWeight: '600',
    color: tokens.colors.textPrimary || '#FFFFFF',
    marginBottom: 8,
  },
  cardText: {
    fontSize: tokens.fontSize.md || 14,
    color: tokens.colors.textSecondary || '#AAAAAA',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricBox: {
    width: '48%',
    backgroundColor: tokens.colors.cardBackground || '#1E1E1E',
    borderRadius: 8,
    padding: tokens.spacing.md || 12,
    marginBottom: tokens.spacing.md || 12,
  },
  metricLabel: {
    fontSize: tokens.fontSize.sm || 12,
    color: tokens.colors.textSecondary || '#AAAAAA',
  },
  metricValue: {
    fontSize: tokens.fontSize.lg || 18,
    fontWeight: 'bold',
    color: tokens.colors.accent || '#00E676',
    marginTop: 4,
  },
});
