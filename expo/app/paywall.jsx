import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEntitlement } from '@/hooks/useEntitlement';
import { planCards } from '@/lib/plans';
import { FEATURE_NAMES, TIERS, TIER_NAMES, featureTier, tierAtLeast } from '@/lib/entitlements';
import { PURCHASES_ENABLED, purchasePlan } from '@/services/purchases';

// The plans: Free, Pro and Legend, what each one includes, which one the person has, and a button to move up. The lists come from
// lib/plans.js, which builds them from the rules in lib/entitlements.js. Until purchases are connected (services/purchases.js) the
// buttons say so and do nothing, and a plan is set by hand on the person's entitlements document.
//
//   ?feature=<key>   the feature the person was turned away from (lib/entitlements.js FEATURES); the screen says which plan it is on
export default function PaywallScreen() {
  const params = useLocalSearchParams();
  const { tier } = useEntitlement();
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');

  const wanted = typeof params.feature === 'string' && FEATURE_NAMES[params.feature] ? params.feature : null;
  const lockedOut = wanted && !tierAtLeast(tier, featureTier(wanted)) ? wanted : null;

  const buy = async (plan) => {
    if (buying) return;
    setBuying(plan);
    setError('');
    try {
      const result = await purchasePlan(plan);
      if (!result.ok) setError(result.error || 'That did not go through.');
    } catch (e) {
      setError('That did not go through.');
    } finally {
      setBuying(null);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile/settings'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable testID="paywall-back" accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Plans</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {lockedOut ? (
          <View testID="paywall-wanted" style={styles.wanted}>
            <Text style={styles.wantedText}>{FEATURE_NAMES[lockedOut]} is part of {TIER_NAMES[featureTier(lockedOut)]}.</Text>
          </View>
        ) : null}

        {planCards().map((card) => {
          const mine = card.tier === tier;
          const higher = TIERS.indexOf(card.tier) > TIERS.indexOf(tier);
          return (
            <View key={card.tier} testID={`plan-${card.tier}`} style={[styles.card, mine && styles.cardMine]}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{card.name}</Text>
                {mine ? <Text testID={`plan-${card.tier}-current`} style={styles.current}>Your plan</Text> : null}
              </View>
              <Text style={styles.tagline}>{card.tagline}</Text>
              {card.features.map((line) => (
                <View key={line} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color="#000000" />
                  <Text style={styles.featureText}>{line}</Text>
                </View>
              ))}
              {higher ? (
                <Pressable
                  testID={`plan-${card.tier}-buy`}
                  accessibilityRole="button"
                  disabled={!PURCHASES_ENABLED || !!buying}
                  style={[styles.buy, (!PURCHASES_ENABLED || buying) && styles.buyOff]}
                  onPress={() => buy(card.tier)}>
                  <Text style={styles.buyText}>
                    {!PURCHASES_ENABLED ? 'Coming soon' : buying === card.tier ? 'One moment...' : `Upgrade to ${card.name}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        {error ? <Text testID="paywall-error" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {PURCHASES_ENABLED ? null : (
          <Text testID="paywall-note" style={styles.note}>
            Subscriptions are not open yet. Your plan will change here as soon as they are.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000' },
  content: { padding: 16, paddingBottom: 40 },
  wanted: { backgroundColor: '#000000', borderRadius: 12, padding: 14, marginBottom: 16 },
  wantedText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  card: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 16, padding: 18, marginBottom: 14, backgroundColor: '#FFFFFF' },
  cardMine: { borderColor: '#000000', borderWidth: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 22, fontWeight: '800', color: '#000000' },
  current: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  tagline: { fontSize: 14, color: '#666666', marginTop: 2, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  featureText: { flex: 1, fontSize: 15, color: '#000000' },
  buy: { marginTop: 14, paddingVertical: 13, borderRadius: 999, backgroundColor: '#000000', alignItems: 'center' },
  buyOff: { opacity: 0.4 },
  buyText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center', marginTop: 4 },
  note: { fontSize: 13, color: '#888888', textAlign: 'center', marginTop: 8 },
});
