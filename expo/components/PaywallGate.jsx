import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEntitlement } from '@/hooks/useEntitlement';
import { FEATURE_NAMES, TIER_NAMES, featureTier } from '@/lib/entitlements';

// Puts a whole screen behind a plan: a person whose plan includes `feature` (lib/entitlements.js) sees the screen, anyone else sees what
// it is, which plan it is part of, and a button to the plans. While the phone is still finding out the plan it shows nothing but a
// spinner, so someone who has the plan never sees the lock flash up first.
//
//   feature   a key of FEATURES in lib/entitlements.js
//   children  the screen
// The server holds the real line (an AI feature is refused there too); this is the part a person sees.
export default function PaywallGate({ feature, children }) {
  const { can, ready } = useEntitlement();
  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator testID="gate-loading" color="#000000" /></View>
      </SafeAreaView>
    );
  }
  if (can(feature)) return <>{children}</>;

  const needs = featureTier(feature);
  const name = FEATURE_NAMES[feature] || 'This feature';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/hq'));
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable testID="gate-back" accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </Pressable>
      </View>
      <View testID="gate-locked" style={styles.center}>
        <View style={styles.lock}><Ionicons name="lock-closed" size={28} color="#FFFFFF" /></View>
        <Text style={styles.title}>{name} is part of {TIER_NAMES[needs]}</Text>
        <Text style={styles.body}>Upgrade to {TIER_NAMES[needs]} to unlock it.</Text>
        <Pressable
          testID="gate-see-plans"
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => router.push({ pathname: '/paywall', params: { feature } })}>
          <Text style={styles.primaryText}>See plans</Text>
        </Pressable>
        <Pressable testID="gate-not-now" accessibilityRole="button" style={styles.secondary} onPress={back}>
          <Text style={styles.secondaryText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#000000', textAlign: 'center' },
  body: { fontSize: 15, color: '#666666', textAlign: 'center', marginTop: 8 },
  primary: { marginTop: 28, alignSelf: 'stretch', paddingVertical: 14, borderRadius: 999, backgroundColor: '#000000', alignItems: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondary: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24 },
  secondaryText: { fontSize: 15, fontWeight: '600', color: '#666666' },
});
