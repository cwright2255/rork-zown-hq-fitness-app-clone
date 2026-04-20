import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../constants/tokens';
import { useWearables } from '../hooks/useWearables';

export function WearablesCard({ userId }) {
  const router = useRouter();
  const {
    isLoading,
    hasPermissions,
    todaySteps,
    todayCalories,
    todaySleep,
    requestPermissions,
    syncData,
    isExpoGo
  } = useWearables(userId);

  const manageDevicesButton =
  <TouchableOpacity
    style={styles.manageButton}
    onPress={() => router.push('/rook-connect')}
    accessibilityLabel="Manage connected wearable devices">
    
      <Text style={styles.manageButtonText}>Manage Connected Devices</Text>
    </TouchableOpacity>;


  if (isExpoGo) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Health & Wearables</Text>
        <Text style={styles.subtitle}>
          Available in the full dev client build. Run `eas build --platform ios --profile development` to enable Apple Health sync.
        </Text>
        {manageDevicesButton}
      </View>);

  }

  if (!hasPermissions) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Connect Health Data</Text>
        <Text style={styles.subtitle}>Sync steps, heart rate, sleep, and calories from Apple Health</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={requestPermissions}
          disabled={isLoading}
          accessibilityLabel="Connect Apple Health">
          
          {isLoading ?
          <ActivityIndicator color="#fff" size="small" /> :

          <Text style={styles.buttonText}>Connect Apple Health</Text>
          }
        </TouchableOpacity>
        {manageDevicesButton}
      </View>);

  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today's Health</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{todaySteps ?? '—'}</Text>
          <Text style={styles.metricLabel}>Steps</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{todayCalories ?? '—'}</Text>
          <Text style={styles.metricLabel}>Calories</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{todaySleep ?? '—'}</Text>
          <Text style={styles.metricLabel}>Sleep hrs</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.syncButton]}
        onPress={syncData}
        disabled={isLoading}
        accessibilityLabel="Sync health data">
        
        {isLoading ?
        <ActivityIndicator color={Colors.primary} size="small" /> :

        <Text style={[styles.buttonText, { color: Colors.primary }]}>Sync Now</Text>
        }
      </TouchableOpacity>
      {manageDevicesButton}
    </View>);

}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.xs
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.size.sm,
    lineHeight: Typography.size.sm * Typography.lineHeight.relaxed,
    marginBottom: Spacing.md
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md
  },
  metric: {
    alignItems: 'center'
  },
  metricValue: {
    color: Colors.primary,
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold
  },
  metricLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.size.xs,
    marginTop: 2
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center'
  },
  syncButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary
  },
  buttonText: {
    color: '#fff',
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold
  },
  manageButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center'
  },
  manageButtonText: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    textDecorationLine: 'underline'
  }
});