import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';

export default function NotificationsSettingsScreen() {
  const { user } = useUserStore();
  const notifications = useSettingsStore((st) => st.notifications);
  const updateSetting = useSettingsStore((st) => st.updateSetting);

  // On unless it has been switched off, the same reading the reminders themselves use (lib/remindersAllowed.js).
  const on = notifications !== false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.sectionDesc}>
          One switch for the alerts Zown HQ sets on your phone: calendar reminders, the alert when a fast reaches its goal, and cooking timers.
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={20} color="#000" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.toggleTitle}>Notifications</Text>
              <Text style={styles.toggleDesc}>
                {on ? 'On. Zown HQ will set the alerts above.' : 'Off. Zown HQ will not set any of them, and the ones already set have been cleared.'}
              </Text>
            </View>
            <Switch
              value={on}
              onValueChange={(val) => updateSetting('notifications', val, user?.uid)}
              accessibilityLabel="Notifications"
              trackColor={{ false: '#767577', true: '#000' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFF'}
            />
          </View>
        </View>

        <Text style={styles.note}>
          Alerts also need notifications allowed for Zown HQ in your phone's Settings. If you turned them off there, this switch cannot turn them back on.
        </Text>
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
  note: { fontSize: 12, color: '#666', lineHeight: 16 },
});
