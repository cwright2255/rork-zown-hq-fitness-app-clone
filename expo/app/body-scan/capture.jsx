import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../../theme/tokens';

export default function BodyScanCaptureScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Body Scan Capture" showBack />
      <View style={styles.content}>
        <Text style={styles.title}>3D Body Scan</Text>
        <Text style={styles.subtitle}>Rotate 360 degrees or hold still while recording</Text>
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
