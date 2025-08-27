import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useShopStore } from '@/store/shopStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useExpStore } from '@/store/expStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BadgeCheck, RefreshCw, LogOut, Users, ShoppingBag, BarChart3 } from 'lucide-react-native';

export default function AdminPanel() {
  const { user, isOnboarded, completeOnboarding, startOnboarding, logout, initializeDefaultUser } = useUserStore();
  const { cart, clearCart } = useShopStore();
  const { workouts } = useWorkoutStore.getState();
  const analytics = useAnalyticsStore.getState();
  const expStore = useExpStore.getState();

  const [busy, setBusy] = useState<boolean>(false);

  const cartCount = useMemo(() => cart.reduce((n, i) => n + i.quantity, 0), [cart]);

  const ensureDefaultUser = useCallback(() => {
    if (!user) {
      initializeDefaultUser();
    }
  }, [user, initializeDefaultUser]);

  const handleLogout = useCallback(async () => {
    try {
      setBusy(true);
      await logout();
      const { router } = await import('expo-router');
      router.replace('/');
    } catch (e) {
      Alert.alert('Logout error', 'Failed to log out. Please try again.');
      console.error('[AdminPanel] Logout failed', e);
    } finally {
      setBusy(false);
    }
  }, [logout]);

  const nukeLocalState = useCallback(async () => {
    try {
      setBusy(true);
      clearCart?.();
      await AsyncStorage.multiRemove([
        'zown-user-storage',
        'zown-exp-storage',
        'zown-shop-storage',
        'workout-storage',
      ]);
      expStore.initializeExpSystem?.();
      startOnboarding();
      Alert.alert('Reset complete', 'Local state has been cleared.');
    } catch (e) {
      console.error('[AdminPanel] Reset failed', e);
    } finally {
      setBusy(false);
    }
  }, [clearCart, expStore, startOnboarding]);

  const toggleOnboarding = useCallback(() => {
    if (isOnboarded) {
      startOnboarding();
    } else {
      completeOnboarding();
    }
  }, [isOnboarded, startOnboarding, completeOnboarding]);

  return (
    <View style={styles.root} testID="admin-root">
      <Stack.Screen options={{ title: 'Control Panel', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="admin-title">Universal App Control Panel</Text>

        <View style={styles.section} testID="admin-user-section">
          <Text style={styles.sectionTitle}>User</Text>
          <Text style={styles.meta}>Onboarded: {String(isOnboarded)}</Text>
          <Text style={styles.meta}>User: {user?.email ?? 'none'}</Text>
          <View style={styles.row}>
            <ActionButton label="Ensure Default User" onPress={ensureDefaultUser} disabled={busy} />
            <ActionButton label={isOnboarded ? 'Set Not Onboarded' : 'Complete Onboarding'} onPress={toggleOnboarding} disabled={busy} />
          </View>
          <View style={styles.row}>
            <ActionButton label="Log out" onPress={handleLogout} disabled={busy} />
          </View>
        </View>

        <View style={styles.section} testID="admin-shop-section">
          <Text style={styles.sectionTitle}>Shop</Text>
          <Text style={styles.meta}>Cart items: {cartCount}</Text>
          <View style={styles.row}>
            <ActionButton label="Clear Cart" onPress={() => clearCart?.()} disabled={busy} />
          </View>
        </View>

        <View style={styles.section} testID="admin-analytics-section">
          <Text style={styles.sectionTitle}>Analytics</Text>
          <Text style={styles.meta}>Weekly workouts (mock): {analytics.getAnalytics('week').workoutsCompleted}</Text>
        </View>

        <View style={styles.section} testID="admin-other-section">
          <Text style={styles.sectionTitle}>System</Text>
          <View style={styles.row}>
            <ActionButton label="Reset All Local State" onPress={nukeLocalState} disabled={busy} />
          </View>
          <Text style={styles.note}>Platform: {Platform.OS}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.button, disabled ? styles.buttonDisabled : undefined]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} testID={`admin-action-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <View style={styles.buttonInner}>
        <Text style={styles.buttonLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginBottom: 12 },
  section: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, marginBottom: 12, borderColor: Colors.border, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 8 },
  meta: { fontSize: 13, color: Colors.text.secondary, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' as const },
  button: { backgroundColor: Colors.background, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderColor: Colors.border, borderWidth: 1 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 20, height: 20, justifyContent: 'center' },
  buttonLabel: { fontSize: 14, color: Colors.text.primary, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  note: { marginTop: 8, fontSize: 12, color: Colors.text.secondary },
});