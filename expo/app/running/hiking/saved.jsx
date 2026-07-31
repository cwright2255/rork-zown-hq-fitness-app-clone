// app/running/hiking/saved.jsx
//
// Where the bookmark button on the trail list/detail screens actually
// leads. Before this, toggleSaveTrail() correctly wrote to Firestore and
// toggled the bookmark icon, but there was no way to ever look at the
// list you'd built - a real, functional save with no way to ever see
// what you'd saved.

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { getPhotoUrl } from '@/services/hikingService';

export default function SavedTrailsScreen() {
  const router = useRouter();
  const { trails, savedTrailIds, loadSavedTrails, isLoading } = useHikingStore();
  const { user } = useUserStore();

  useEffect(() => {
    if (user?.uid) loadSavedTrails(user.uid);
  }, [user?.uid]);

  // Saved trails are only ever shown here if they're also present in the
  // current `trails` list (populated by the last nearby search) - this
  // screen doesn't re-fetch each saved trail individually, so a trail
  // saved on a previous visit that's now outside search range won't
  // appear until a nearby search including it runs again. Simpler and
  // avoids one extra API call path; noted rather than silently assumed.
  const savedTrails = useMemo(
    () => trails.filter((t) => savedTrailIds.includes(t.id)),
    [trails, savedTrailIds]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Saved Trails" showBack />

      {isLoading && savedTrails.length === 0 ? (
        <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 40 }} />
      ) : savedTrails.length === 0 ? (
        <View style={styles.centerBlock}>
          <Ionicons name="bookmark-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerText}>
            No saved trails yet. Tap the bookmark icon on a trail to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedTrails}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const photoUrl = item.photoUrl || (item.photoName ? getPhotoUrl(item.photoName, 300) : null);
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/running/hiking/${item.id}`)}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>{item.address}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  list: { padding: spacing.base },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
