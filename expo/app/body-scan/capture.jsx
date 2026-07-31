import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { tokens } from '../../../theme/tokens';

export default function BodyScanCaptureScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>3D Body Scan Capture</Text>
      <Text style={styles.subtitle}>Position yourself in the camera view to begin scan.</Text>
      <TouchableOpacity style={styles.captureButton}>
        <Text style={styles.buttonText}>Start Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background || '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg || 16,
  },
  title: {
    fontSize: tokens.fontSize.xxl || 22,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary || '#FFFFFF',
    marginBottom: tokens.spacing.sm || 8,
  },
  subtitle: {
    fontSize: tokens.fontSize.md || 14,
    color: tokens.colors.textSecondary || '#AAAAAA',
    textAlign: 'center',
    marginBottom: tokens.spacing.xl || 24,
  },
  captureButton: {
    backgroundColor: tokens.colors.primary || '#FF5500',
    paddingHorizontal: tokens.spacing.xl || 32,
    paddingVertical: tokens.spacing.md || 14,
    borderRadius: tokens.borderRadius.lg || 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: tokens.fontSize.md || 16,
  },
});
