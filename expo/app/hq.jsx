import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

export default function HQScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { totalExp, level } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();

  const displayName = user?.name || user?.email?.split('@')[0] || 'Carlton';

  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dateStr = String(now.getDate()).padStart(2, '0') + ' ' + MONTHS[now.getMonth()];

  const workoutCount = completedWorkouts?.length || 0;
  const calories = useMemo(() => {
    if (workoutCount === 0) return '0';
    return (workoutCount * 310.34).toFixed(2);
  }, [workoutCount]);
  const steps = useMemo(() => {
    const raw = workoutCount * 620 || 1240;
    return raw.toLocaleString().replace(',', ' ');
  }, [workoutCount]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}>

        {/* ── Header row ── */}
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
          <TouchableOpacity
            style={styles.calendarBtn}
            onPress={() => router.push('/analytics')}
            activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* ── Section title ── */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Today's Information</Text>
            <Text style={styles.sectionSub}>{MONTHS[now.getMonth()]} {now.getFullYear()}</Text>
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => { /* TODO: options menu */ }}>
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* ── Stat cards 2x2 ── */}
        <View style={styles.grid}>
          <StatCard icon="flame-outline" label="Calories" value={calories} unit="Kcal" />
          <StatCard icon="heart-outline" label="Heart" value="74" unit="bpm" />
          <StatCard icon="footsteps-outline" label="Steps" value={steps} unit="Steps" />
          <StatCard icon="moon-outline" label="Sleep" value="7.5" unit="Hours" />
        </View>

        {/* ── Invite banner ── */}
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
    marginBottom: 24,
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

  /* banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 16,
    gap: 14,
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
