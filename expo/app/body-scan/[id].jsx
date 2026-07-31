import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../../theme/tokens';

export default function BodyScanDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Body Scan Analysis" showBack />
      <View style={styles.content}>
        <Text style={styles.title}>Scan ID: {id}</Text>
        <Text style={styles.subtitle}>3D Body Mesh & Composition Analysis</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    flex: 1,
    padding: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary,
  },
  subtitle: {
    fontSize: tokens.typography.sizes.sm,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
  },
});
