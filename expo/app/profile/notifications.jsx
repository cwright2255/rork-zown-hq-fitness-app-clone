import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';

export default function NotificationsSettingsScreen() {
  const { user } = useUserStore();
  const settings = useSettingsStore();

  const toggleVal = (key) => {
    // If the setting is stored, use it. Otherwise, default to true.
    return settings[key] !== undefined ? settings[key] : true;
  };

  const handleToggle = (key, val) => {
    if (settings.updateSetting) {
      settings.updateSetting(key, val, user?.uid);
    }
  };

  const TOGGLES = [
    {
      key: 'workoutReminders',
      title: 'Workout Reminders',
      desc: 'Get alerted when it\'s time to log or start a workout.',
      icon: 'fitness-outline',
    },
    {
      key: 'achievementAlerts',
      title: 'Achievement Alerts',
      desc: 'Instant badges, level-ups, and tier rewards alerts.',
      icon: 'trophy-outline',
    },
    {
      key: 'socialActivity',
      title: 'Social Activity',
      desc: 'When friends send duels, messages, or interact with feed posts.',
      icon: 'people-outline',
    },
    {
      key: 'nutritionReminders',
      title: 'Nutrition Reminders',
      desc: 'Friendly nudges to log daily hydration, meals, and macronutrients.',
      icon: 'nutrition-outline',
    },
    {
      key: 'weeklySummary',
      title: 'Weekly Summary',
      desc: 'Every Sunday, get a comprehensive performance and streak wrap-up.',
      icon: 'calendar-outline',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.sectionDesc}>Customize how and when you receive push notifications from ZOWN HQ.</Text>

        <View style={styles.card}>
          {TOGGLES.map((t, idx) => (
            <View key={t.key}>
              <View style={styles.row}>
                <View style={styles.iconCircle}>
                  <Ionicons name={t.icon} size={20} color="#000" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleTitle}>{t.title}</Text>
                  <Text style={styles.toggleDesc}>{t.desc}</Text>
                </View>
                <Switch
                  value={toggleVal(t.key)}
                  onValueChange={(val) => handleToggle(t.key, val)}
                  trackColor={{ false: '#767577', true: '#000' }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFF'}
                />
              </View>
              {idx < TOGGLES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Quiet Hours */}
        <Text style={styles.sectionTitle}>Quiet Hours</Text>
        <Pressable style={styles.quietHoursCard}>
          <View style={styles.quietHoursRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="moon-outline" size={20} color="#666" />
              <View>
                <Text style={styles.quietTitle}>Do Not Disturb</Text>
                <Text style={styles.quietSubtitle}>10:00 PM - 7:00 AM</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </Pressable>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginTop: 12, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#666', marginBottom: 20 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  toggleDesc: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#F0F0F0' },

  /* Quiet Hours */
  quietHoursCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
  },
  quietHoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quietTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  quietSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
});
