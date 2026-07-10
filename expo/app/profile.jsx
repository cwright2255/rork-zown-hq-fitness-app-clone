import AnimatedPressable from '@/components/AnimatedPressable';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

/* ─── Placeholder data ─── */

const EARNED_BADGES = [
  { icon: 'trophy', label: 'First Workout' },
  { icon: 'fitness', label: '5K Runner' },
  { icon: 'flame', label: '7-Day Streak' },
  { icon: 'sunny', label: 'Early Bird' },
];

const LOCKED_BADGES = [
  { icon: 'medal', label: 'Marathon' },
  { icon: 'star', label: '100 Workouts' },
  { icon: 'shield', label: 'Elite Level' },
];

const MENU_GROUPS = [
  {
    label: 'Activity',
    items: [
      { icon: 'create-outline', label: 'Edit Profile', route: '/profile/edit' },
      { icon: 'time-outline', label: 'Workout History', route: '/workouts' },
      { icon: 'fitness-outline', label: 'Running Log', route: '/profile/running-log' },
      { icon: 'trophy-outline', label: 'Personal Records', route: '/analytics' },
      { icon: 'body-outline', label: 'Body Scan', route: '/body-scan' },
    ],
  },
  {
    label: 'Health & Nutrition',
    items: [
      { icon: 'heart-outline', label: 'Health Dashboard', route: '/health' },
      { icon: 'nutrition-outline', label: 'Meal Log', route: '/nutrition/log' },
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

/* ─── Menu row ─── */

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
    <AnimatedPressable style={styles.menuRow} onPress={handlePress}>
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

/* ─── Main screen ─── */

export default function ProfileScreen() {
  const { user, updateUser, saveProfile } = useUserStore();
  const { totalExp } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();

  const profileName = user?.name || user?.email?.split('@')[0] || 'User';
  const profileEmail = user?.email || '';
  const profilePhoto = user?.photoURL || null;
  const workoutCount = completedWorkouts?.length || 0;
  const runCount = (completedWorkouts || []).filter(w => w.category === 'running' || w.category === 'run').length;
  const streakDays = user?.streakData?.currentStreak || 0;

  const STATS_LIVE = [
    { value: totalExp ? totalExp.toLocaleString() : '0', label: 'Total XP' },
    { value: String(workoutCount), label: 'Workouts' },
    { value: String(runCount), label: 'Runs' },
    { value: String(streakDays), label: 'Streak' },
  ];

  const xpCurrent = totalExp || 2450;
  const xpLevel = Math.floor(xpCurrent / 1000) + 1;
  const xpTarget = xpLevel * 1000;
  const xpLevelStart = (xpLevel - 1) * 1000;
  const xpCurrentInLevel = xpCurrent - xpLevelStart;
  const xpTargetInLevel = 1000;
  const xpPercent = Math.min(Math.max(Math.round((xpCurrentInLevel / xpTargetInLevel) * 100), 0), 100);

  const handleEditPhoto = async () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option to update your profile photo:',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera permission is required to take photo.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const uri = result.assets[0].uri;
              updateUser({ photoURL: uri });
              if (user?.uid) {
                await saveProfile(user.uid);
              }
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery permission is required to select photo.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const uri = result.assets[0].uri;
              updateUser({ photoURL: uri });
              if (user?.uid) {
                await saveProfile(user.uid);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <Text style={styles.userHandle}>@{profileName.toLowerCase().replace(/\s+/g, '_')}</Text>
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
            {xpTarget - xpCurrent} XP to Level {xpLevel + 1}
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
          {EARNED_BADGES.map((b) => (
            <View key={b.label} style={styles.badgeItem}>
              <View style={styles.badgeCircleEarned}>
                <Ionicons name={b.icon} size={22} color="#FFD700" />
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {b.label}
              </Text>
            </View>
          ))}
          {LOCKED_BADGES.map((b) => (
            <View key={b.label} style={styles.badgeItem}>
              <View style={styles.badgeCircleLocked}>
                <Ionicons name={b.icon} size={22} color="#CCC" />
              </View>
              <Text style={styles.badgeLabel} numberOfLines={2}>
                {b.label}
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

/* ─── Styles ─── */

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
