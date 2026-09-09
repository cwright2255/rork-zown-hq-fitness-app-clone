import LoadingSkeleton from '@/src/components/LoadingSkeleton';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';

/* âââ Placeholder data âââ */

import { useAchievementStore } from '@/store/achievementStore';

const LOCKED_BADGES_UNUSED = [
  { icon: 'medal', label: 'Marathon' },
  { icon: 'star', label: '100 Workouts' },
  { icon: 'shield', label: 'Elite Level' },
];

const MENU_GROUPS = [
  {
    label: 'Activity',
    items: [
      { icon: 'create-outline', label: 'Edit Profile', route: '/profile/edit' },
      { icon: 'time-outline', label: 'Workout History', route: '/profile/workout-history' },
      { icon: 'fitness-outline', label: 'Running Log', route: '/profile/running-log' },
      { icon: 'trophy-outline', label: 'Personal Records', route: '/analytics' },
      { icon: 'body-outline', label: 'Body Scan', route: '/body-scan/capture' },
    ],
  },
  {
    label: 'Health & Nutrition',
    items: [
      { icon: 'heart-outline', label: 'Health Dashboard', route: '/health' },
      { icon: 'nutrition-outline', label: 'Meal Log', route: '/nutrition' },
      { icon: 'bookmark-outline', label: 'Recipes Saved', route: '/recipes' },
    ],
  },
  {
    label: 'Social',
    items: [
      { icon: 'people-outline', label: 'Friends', route: '/social' },
      { icon: 'podium-outline', label: 'Leaderboard', route: '/social' }, // Will handle specific tab parameter or general
      { icon: 'share-social-outline', label: 'Share Profile' },
    ],
  },
  {
    label: 'Account',
    items: [
      { icon: 'settings-outline', label: 'Settings', route: '/profile/settings' },
      { icon: 'notifications-outline', label: 'Notifications', route: '/profile/notifications' },
      { icon: 'help-circle-outline', label: 'Help & Support', route: '/profile/help' },
      { icon: 'log-out-outline', label: 'Log Out', danger: true },
    ],
  },
];

/* âââ Menu row âââ */

function MenuRow({ item }) {
  const handlePress = async () => {
    if (item.danger) {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => router.replace('/auth/login') },
      ]);
      return;
    }
    if (item.label === 'Share Profile') {
      try {
        await Share.share({
          message: 'Check out my fitness profile on ZOWN HQ! Tracking my workouts, running stats, and body composition. Join me!',
          url: 'https://zownhq.com/profile/carlton_w',
        });
      } catch (error) {
        console.warn('Error sharing profile:', error.message);
      }
      return;
    }
    if (item.label === 'Leaderboard') {
      router.push('/social?tab=leaderboard');
      return;
    }
    if (item.route) {
      router.push(item.route);
    }
  };

  return (
    <Pressable style={styles.menuRow} onPress={handlePress}>
      <Ionicons
        name={item.icon}
        size={20}
        color={item.danger ? '#FF3B30' : '#000'}
        style={styles.menuIcon}
      />
      <Text style={[styles.menuLabel, item.danger && { color: '#FF3B30' }]}>
        {item.label}
      </Text>
      {!item.danger && (
        <Ionicons name="chevron-forward" size={16} color="#CCC" />
      )}
    </Pressable>
  );
}

/* âââ Main screen âââ */

export default function ProfileScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, loadProfile, updateUser, saveProfile } = useUserStore();
  const { loadXP, getLevel, getExpForLevel, getExpToNextLevel, getTotalExp } = useExpStore();
  // Real fix: totalExp was destructured directly from useExpStore(),
  // but that top-level property never existed on the store - it only
  // ever lived nested inside expSystem.totalExp, so this was always
  // reading undefined, always falling back to 0 regardless of the
  // real, correctly-updating value.
  const totalExp = getTotalExp ? getTotalExp() : 0;

  // Real fix: loadXP was previously only ever called from onRefresh
  // (pull-to-refresh) - opening this screen normally never fetched
  // fresh XP at all, so it could silently show stale data from
  // whatever was last cached, with no way to tell that had happened.
  const { achievements, getUnlockedAchievements, getLockedAchievements, loadAchievements } = useAchievementStore();

  useEffect(() => {
    if (user?.uid) {
      loadXP(user.uid);
      loadAchievements(user.uid);
    }
  }, [user?.uid]);
  const { completedWorkouts, loadWorkouts } = useWorkoutStore();

  // Real fix: this previously hardcoded a flat "1000 XP per level"
  // formula, matching what expStore.js used to do - but that store's
  // own level curve is now the real, verified exponential curve from
  // the design spreadsheet (LEVEL_GROWTH_RATE), where each level needs
  // a different amount of XP, not a flat 1000. This now reads the
  // store's own real thresholds (getExpForLevel/getExpToNextLevel)
  // instead of recomputing a separate, now-incorrect assumption here.
  const xpLevel = getLevel ? getLevel() : 1;
  const currentLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel) : 0;
  const nextLevelThreshold = getExpForLevel ? getExpForLevel(xpLevel + 1) : currentLevelThreshold + 1000;
  const xpCurrent = Math.round(Math.max(0, (totalExp || 0) - currentLevelThreshold));
  const xpNeededForLevel = Math.max(1, nextLevelThreshold - currentLevelThreshold);
  const xpPercent = Math.min(100, Math.max(0, (xpCurrent / xpNeededForLevel) * 100));
  // Real fix: fractional XP (e.g. steps-XP's per-step rate) could
  // otherwise surface as a decimal here and in Total XP below -
  // Math.round applied at display time only, doesn't change totalExp
  // or level-progression math itself.
  const xpRemaining = Math.round(getExpToNextLevel ? getExpToNextLevel() : Math.max(0, nextLevelThreshold - (totalExp || 0)));

  const STATS_LIVE = [
    { label: 'Workouts', value: completedWorkouts?.length || 0 },
    { label: 'Streak', value: user?.streak || 0 },
    { label: 'Total XP', value: Math.round(totalExp || 0) },
  ];

  // Real fix: these were referenced throughout this screen (profile
  // photo, display name, edit handler below) but never actually
  // declared anywhere - a genuine crash on every load, not just a
  // missing default. Derived from the real user store fields
  // (confirmed directly in userStore.js: user.name, user.photoURL),
  // not invented new state.
  const profilePhoto = user?.photoURL || '';
  const profileName = user?.name || 'User';

  const handleEditPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to update your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      updateUser({ photoURL: result.assets[0].uri });
      if (user?.uid) {
        await saveProfile(user.uid);
      }
    } catch (e) {
      console.warn('[ProfileScreen] Edit photo failed:', e?.message);
      Alert.alert('Error', 'Could not update your photo. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    try {
      if (user?.uid) {
        await Promise.all([
          loadProfile(user.uid),
          loadXP(user.uid),
          loadWorkouts(user.uid)
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/profile/settings')}>
            <Ionicons name="settings-outline" size={22} color="#000" />
          </Pressable>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#999" />
            )}
          </View>
          <Pressable onPress={handleEditPhoto}>
            <Text style={styles.editPhoto}>Edit Photo</Text>
          </Pressable>
          <Text style={styles.userName}>{profileName}</Text>
          {user?.username ? (
            <Text style={styles.userHandle}>@{user.username}</Text>
          ) : null}
          <Text style={styles.memberSince}>Member since May 2026</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsCard}>
          {STATS_LIVE.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* XP Level */}
        <View style={styles.xpCard}>
          <View style={styles.xpHeader}>
            <View style={styles.xpLevelRow}>
              <Text style={styles.xpLevel}>Level {xpLevel}</Text>
              <Ionicons name="star" size={16} color="#FFD700" />
            </View>
            <Text style={styles.xpCount}>{xpCurrent} XP</Text>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: xpPercent + '%' }]} />
          </View>
          <Text style={styles.xpRemaining}>
            {xpRemaining} XP to Level {xpLevel + 1}
          </Text>
        </View>

        {/* Achievements */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Pressable onPress={() => router.push('/achievements')}>
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgeScroll}
        >
          {getUnlockedAchievements().map((a) => (
            <View key={a.id} style={styles.badgeItem}>
              <View style={styles.badgeCircleEarned}>
                <Text style={{ fontSize: 20 }}>{a.icon}</Text>
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {a.name}
              </Text>
            </View>
          ))}
          {getLockedAchievements().map((a) => (
            <View key={a.id} style={styles.badgeItem}>
              <View style={styles.badgeCircleLocked}>
                <Text style={{ fontSize: 20, opacity: 0.4 }}>{a.icon}</Text>
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {a.name}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Menu sections */}
        {MENU_GROUPS.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((item) => (
              <MenuRow key={item.label} item={item} />
            ))}
          </View>
        ))}

        {/* App version */}
        <Text style={styles.appVersion}>ZOWN HQ v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* âââ Styles âââ */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  logo: { width: 120, height: 36 },

  /* Header */
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Profile card */
  profileCard: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0E0E0',
    borderWidth: 3, borderColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImage: { width: 94, height: 94, borderRadius: 47 },
  editPhoto: { fontSize: 11, color: '#666', marginTop: 6 },
  userName: { fontSize: 22, fontWeight: '800', color: '#000', marginTop: 10 },
  userHandle: { fontSize: 14, color: '#999', marginTop: 2 },
  memberSince: { fontSize: 12, color: '#999', marginTop: 4 },

  /* Stats */
  statsCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: 20, marginBottom: 24, paddingVertical: 16,
    backgroundColor: '#FFF', borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#000' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 2 },

  /* XP */
  xpCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    marginHorizontal: 20, marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  xpHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  xpLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpLevel: { fontSize: 16, fontWeight: '700', color: '#000' },
  xpCount: { fontSize: 13, color: '#666' },
  xpBarBg: { height: 8, borderRadius: 4, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  xpBarFill: { height: 8, borderRadius: 4, backgroundColor: '#000' },
  xpRemaining: { fontSize: 12, color: '#999', marginTop: 6 },

  /* Achievements */
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#666' },
  badgeScroll: { paddingLeft: 20, paddingRight: 6, marginBottom: 24 },
  badgeItem: { width: 80, alignItems: 'center', marginRight: 14 },
  badgeCircleEarned: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  badgeCircleLocked: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },
  badgeLabel: { fontSize: 10, color: '#333', textAlign: 'center', marginTop: 6 },

  /* Menu */
  groupLabel: {
    fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 20, marginTop: 20, marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  menuIcon: { width: 30 },
  menuLabel: { fontSize: 15, fontWeight: '500', color: '#000', flex: 1 },

  /* Footer */
  appVersion: {
    fontSize: 11, color: '#CCC', textAlign: 'center',
    marginTop: 24, marginBottom: 20,
  },
});
