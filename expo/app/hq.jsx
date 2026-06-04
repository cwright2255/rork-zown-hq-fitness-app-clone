import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WORKOUTS = [
  { id: '1', name: 'HIIT Blast', duration: '30 min', icon: 'barbell-outline' },
  { id: '2', name: 'Morning Yoga', duration: '20 min', icon: 'body-outline' },
  { id: '3', name: 'Strength Core', duration: '45 min', icon: 'fitness-outline' },
  { id: '4', name: 'Cardio Mix', duration: '25 min', icon: 'bicycle-outline' },
];

/* ── Reusable half-width stat card ── */
function StatCard({ icon, label, value, unit }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        <Ionicons name={icon} size={20} color="#000" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

/* ── Hydration card with progress bar ── */
function HydrationCard({ glasses, target }) {
  const pct = Math.min((glasses / target) * 100, 100);
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statLabel}>Hydration</Text>
        <Ionicons name="water-outline" size={20} color="#000" />
      </View>
      <Text style={styles.statValue}>{glasses} / {target}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: pct + '%' }]} />
      </View>
      <Text style={styles.statUnit}>glasses</Text>
    </View>
  );
}

/* ── Workout carousel item ── */
function WorkoutItem({ item, onPress }) {
  return (
    <Pressable style={styles.workoutItem} onPress={onPress}>
      <View style={styles.workoutThumb}>
        <Ionicons name={item.icon} size={28} color="#000" />
      </View>
      <Text style={styles.workoutName}>{item.name}</Text>
      <Text style={styles.workoutDuration}>{item.duration}</Text>
    </Pressable>
  );
}

export default function HQScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { totalExp, level } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();

  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dateStr = String(now.getDate()).padStart(2, '0') + ' ' + MONTHS[now.getMonth()];

  const workoutCount = completedWorkouts?.length || 0;
  const calories = useMemo(() => {
    if (!completedWorkouts?.length) return '0';
    return completedWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || w.calories || 0), 0).toLocaleString();
  }, [completedWorkouts]);
  const steps = useMemo(() => {
    return '0';
  }, []);
  const xp = useMemo(() => {
    const val = totalExp || 0;
    return val.toLocaleString();
  }, [totalExp]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}>

        {/* ── Zown logo ── */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={{ width: 120, height: 36 }}
            resizeMode="contain"
          />
        </View>


        {/* ── Header row (existing) ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={22} color="#999" />
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Hello {displayName}!</Text>
              <Text style={styles.dateText}>{dayName}, {dateStr}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => router.push('/analytics')}
              activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section title (existing) ── */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Today's Information</Text>
            <Text style={styles.sectionSub}>{MONTHS[now.getMonth()]} {now.getFullYear()}</Text>
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => { /* TODO: options menu */ }}>
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* ── Row 1: Calories | Heart (existing) ── */}
        {/* ── Row 1b: Steps | Sleep (existing) ── */}
        <View style={styles.grid}>
          <StatCard icon="flame-outline" label="Calories" value={calories} unit="Kcal" />
          <StatCard icon="heart-outline" label="Heart" value="74" unit="bpm" />
          <StatCard icon="footsteps-outline" label="Steps" value={steps} unit="Steps" />
          <StatCard icon="moon-outline" label="Sleep" value="7.5" unit="Hours" />
        </View>

        {/* ── Row 2: XP | Stories Climbed (NEW) ── */}
        <View style={styles.grid}>
          <StatCard icon="star-outline" label="Total XP" value={xp} unit="points" />
          <StatCard icon="trending-up-outline" label="Stories Climbed" value="42" unit="floors" />
        </View>

        {/* ── Row 3: Resting HRV | Hydration (NEW) ── */}
        <View style={styles.grid}>
          <StatCard icon="pulse-outline" label="Resting HRV" value="58" unit="ms" />
          <HydrationCard glasses={5} target={8} />
        </View>

        {/* ── Row 4: Recommended Workouts carousel (NEW) ── */}
        <View style={styles.carouselCard}>
          <Text style={styles.carouselTitle}>Recommended Workouts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}>
            {WORKOUTS.map((w) => (
              <WorkoutItem
                key={w.id}
                item={w}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Invite banner (existing) ── */}
        <TouchableOpacity
          style={styles.banner}
          activeOpacity={0.8}
          onPress={() => router.push('/community')}>
          <View style={styles.bannerIcon}>
            <Ionicons name="trophy-outline" size={22} color="#000" />
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Invite your friends</Text>
            <Text style={styles.bannerSub}>Invite your friends to get a free exercise right away</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
  },

  /* header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 50,
    height: 50,
  },
  headerText: {},
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  calendarBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* section */
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  sectionSub: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },

  /* stat grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginBottom: 12,
  },
  statCard: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  statUnit: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  /* hydration progress bar */
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#000',
  },

  /* workout carousel */
  carouselCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 14,
  },
  carouselScroll: {
    gap: 12,
  },
  workoutItem: {
    width: 140,
  },
  workoutThumb: {
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  workoutDuration: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  /* banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginTop: 8,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  bannerSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
});
