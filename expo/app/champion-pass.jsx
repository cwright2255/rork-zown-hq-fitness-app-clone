import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Award } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useChampionPassStore } from '@/store/championPassStore';
import { tokens } from '../../theme/tokens';



export default function ChampionPassScreen() {
  const store = useChampionPassStore();
  const {
    tiers,
    currentTier,
    isPremium,
    initializeChampionPass,
    upgradeToPremium,
  } = store;

  useEffect(() => {
    if (initializeChampionPass) initializeChampionPass();
  }, []);

  const handleUpgrade = () => {
    try {
      upgradeToPremium?.();
      Alert.alert('Upgraded', 'You are now a Champion Pass Premium member.');
    } catch (e) {
      Alert.alert('Error', 'Unable to upgrade.');
    }
  };

  const tierList = tiers || [];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Champion Pass" showBack />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 140 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Award size={32} color="#000000" />
          </View>
          <Text style={styles.heroTitle}>
            {isPremium ? 'Premium Champion' : 'Champion Pass'}
          </Text>
          <Text style={styles.heroSub}>
            {isPremium ? 'Unlock all tier rewards' : 'Upgrade to unlock exclusive rewards'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Tiers</Text>
        {tierList.map((t, i) => {
          const isCurrent = currentTier === t.id || currentTier === i;
          return (
            <View
              key={t.id || i}
              style={[styles.tierCard, isCurrent && styles.tierCardActive]}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{t.level || i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{t.name || `Tier ${i + 1}`}</Text>
                {t.description ? (
                  <Text style={styles.tierDesc} numberOfLines={2}>{t.description}</Text>
                ) : null}
              </View>
              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Text style={styles.currentText}>Current</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {tierList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No tiers available.</Text>
          </View>
        ) : null}
      </ScrollView>

      {!isPremium ? (
        <View style={styles.bottomBar}>
          <PrimaryButton title="Upgrade Now" onPress={handleUpgrade} />
        </View>
      ) : null}
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass - text_primary (white) used as backgrounds throughout,
// text_muted (a dark-context gray-blue) for secondary text. Cards use
// hq.jsx's own shadow instead of the previous borders. tierCardActive's
// border stays a border (a reasonable way to mark the current tier),
// just changed from the dark-navy bg_primary color to black, same
// "black for active/selected state" convention already used in
// app/wellbeing.jsx. currentPill's background wasn't actually routed
// through dark_navy (rgba(255,255,255,0.1), a semi-transparent white
// overlay) but is included here since it was designed to be visible
// against a dark background and would be nearly invisible on this new
// light one - changed to a light green tint matching the same
// "positive/current indicator" convention already used elsewhere
// (app/nutrition.jsx's calorie badge).
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  heroCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center', marginBottom: 20,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { color: '#000000', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  heroSub: { color: '#666666', fontSize: 13, marginTop: 4, textAlign: 'center' },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 14,
  },
  tierCard: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: 10,
  },
  tierCardActive: { borderColor: '#000000', borderWidth: 2 },
  tierBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  tierBadgeText: { color: '#000000', fontSize: 14, fontWeight: '700' },
  tierName: { color: '#000000', fontSize: 15, fontWeight: '600' },
  tierDesc: { color: '#666666', fontSize: 12, marginTop: 2 },
  currentPill: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  currentText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center',
  },
  empty: { color: '#666666', fontSize: 14 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
