import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Award } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useChampionPassStore } from '@/store/championPassStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Award size={32} color=tokens.colors.background.default />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  heroCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { color: tokens.colors.background.default, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  heroSub: { color: '#999', fontSize: 13, marginTop: 4, textAlign: 'center' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 12,
  },
  tierCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  tierCardActive: { borderColor: tokens.colors.background.default, borderWidth: 2 },
  tierBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  tierBadgeText: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '700' },
  tierName: { color: tokens.colors.background.default, fontSize: 15, fontWeight: '600' },
  tierDesc: { color: '#999', fontSize: 12, marginTop: 2 },
  currentPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  currentText: { color: tokens.colors.background.default, fontSize: 11, fontWeight: '600' },
  emptyCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 24, alignItems: 'center',
  },
  empty: { color: '#999', fontSize: 14 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
