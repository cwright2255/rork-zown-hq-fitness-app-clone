// app/running/hiking/index.jsx
//
// Real hiking trails near the user - only local trails, per the request
// (no browsing a national database, this is strictly "near you"). Cards
// show a real photo where the Places API has one, real distance, and real
// rating. Tapping a card opens the trail's own preview page
// (app/running/hiking/[id].jsx) rather than jumping straight to
// directions, matching the AllTrails-style pattern of a preview before
// commit.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { getPhotoUrl } from '@/services/hikingService';

export default function HikingListScreen() {
  const router = useRouter();
  const { trails, isLoading, error, loadNearbyTrails, savedTrailIds, loadSavedTrails } = useHikingStore();
  const { user } = useUserStore();

  useEffect(() => {
    loadNearbyTrails();
  }, []);

  useEffect(() => {
    if (user?.uid) loadSavedTrails(user.uid);
  }, [user?.uid]);

  const openSettings = () => Linking.openSettings();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Hiking Near You"
        showBack
        rightAction={
          <Pressable onPress={() => router.push('/running/hiking/saved')} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </Pressable>
        }
      />

      {isLoading && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.centerText}>Finding trails near you...</Text>
        </View>
      )}

      {!isLoading && error === 'location_permission_denied' && (
        <View style={styles.centerBlock}>
          <Ionicons name="location-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerText}>
            Location access is needed to show trails near you - this only shows local results, not a general directory.
          </Text>
          <PrimaryButton title="Enable Location" onPress={openSettings} style={{ marginTop: spacing.lg }} />
        </View>
      )}

      {!isLoading && error && error !== 'location_permission_denied' && (
        <View style={styles.centerBlock}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.orange} />
          <Text style={styles.centerText}>Couldn't load nearby trails.</Text>
          <PrimaryButton title="Try Again" onPress={() => loadNearbyTrails()} style={{ marginTop: spacing.lg }} />
        </View>
      )}

      {!isLoading && !error && trails.length === 0 && (
        <View style={styles.centerBlock}>
          <Ionicons name="walk-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerText}>No trails found within range. Try a more populated area.</Text>
        </View>
      )}

      {!isLoading && !error && trails.length > 0 && (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TrailCard
              trail={item}
              saved={savedTrailIds.includes(item.id)}
              onPress={() => router.push(`/running/hiking/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TrailCard({ trail, saved, onPress }) {
  const photoUrl = trail.photoUrl || (trail.photoName ? getPhotoUrl(trail.photoName, 500) : null);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
          </View>
        )}
        {saved && (
          <View style={styles.savedBadge}>
            <Ionicons name="bookmark" size={14} color={colors.text} />
          </View>
        )}
        {trail.distanceKm != null && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeText}>{trail.distanceKm.toFixed(1)} km away</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{trail.name}</Text>
        <Text style={styles.cardAddress} numberOfLines={1}>{trail.address}</Text>
        <View style={styles.cardMetaRow}>
          {trail.rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#F5A623" />
              <Text style={styles.ratingText}>
                {trail.rating.toFixed(1)}{trail.ratingCount > 0 ? ` (${trail.ratingCount})` : ''}
              </Text>
            </View>
          )}
          {trail.lengthMiles != null && (
            <Text style={styles.openText}>{trail.lengthMiles.toFixed(1)} mi</Text>
          )}
          {trail.isOpen != null && (
            <Text style={[styles.openText, { color: trail.isOpen ? colors.green : colors.textSecondary }]}>
              {trail.isOpen ? 'Open now' : 'Closed'}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  list: { padding: spacing.base, gap: spacing.md },
  card: {
    borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden', marginBottom: spacing.md,
  },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 160 },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  savedBadge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, padding: 6,
  },
  distanceBadge: {
    position: 'absolute', bottom: spacing.sm, left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10,
  },
  distanceBadgeText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  cardBody: { padding: spacing.md },
  cardTitle: { ...typography.h4, color: colors.text },
  cardAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { ...typography.caption, color: colors.textSecondary },
  openText: { ...typography.caption, fontWeight: '600' },
});
