import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Award, Lock } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useBadgeStore } from '@/store/badgeStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function BadgesScreen() {
  const store = useBadgeStore();
  const badges = store.badges || [];

  useEffect(() => {
    if (store.initializeBadges) store.initializeBadges();
  }, []);

  const { earned, locked } = useMemo(() => {
    const e = badges.filter(b => b.isUnlocked || b.unlockedAt);
    const l = badges.filter(b => !(b.isUnlocked || b.unlockedAt));
    return { earned: e, locked: l };
  }, [badges]);

  const renderBadge = (b, isLocked) => (
    <View
      key={b.id}
      style={[styles.badge, isLocked && { opacity: 0.4 }]}>
      <View style={styles.badgeIcon}>
        {isLocked ? <Lock size={24} color="#999" /> : <Award size={24} color="#fff" />}
      </View>
      <Text style={styles.badgeName} numberOfLines={2}>{b.name || b.title}</Text>
      {b.description ? (
        <Text style={styles.badgeDesc} numberOfLines={2}>{b.description}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Badges" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.sectionLabel}>Earned ({earned.length})</Text>
        {earned.length === 0 ? (
          <Text style={styles.empty}>No badges earned yet. Keep going!</Text>
        ) : (
          <View style={styles.grid}>{earned.map(b => renderBadge(b, false))}</View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Locked ({locked.length})</Text>
        <View style={styles.grid}>{locked.map(b => renderBadge(b, true))}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 12,
  },
  empty: { color: '#999', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: '31.5%',
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 12, alignItems: 'center',
  },
  badgeIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  badgeName: {
    color: '#fff', fontSize: 12, fontWeight: '600',
    textAlign: 'center',
  },
  badgeDesc: {
    color: '#999', fontSize: 10, textAlign: 'center', marginTop: 4,
  },
});
