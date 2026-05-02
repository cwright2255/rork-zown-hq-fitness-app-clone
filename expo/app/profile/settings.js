import React, { useState } from 'react';
import {
import { tokens } from '../../../theme/tokens';
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import {
  Bell,
  Lock,
  HelpCircle,
  Info,
  LogOut,
  Music,
  ChevronRight,
} from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { authService } from '@/services/authService';
import { spotifyService } from '@/services/spotifyService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SettingsScreen() {
  const { user, updateUserPreferences, logout } = useUserStore();
  const { dailyGoals, updateDailyGoals } = useNutritionStore();
  const {
    isConnected: isSpotifyConnected,
    user: spotifyUser,
    disconnectSpotify,
    musicPreferences,
    updateMusicPreferences,
  } = useSpotifyStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.preferences?.notifications?.workouts || false
  );

  const [caloriesGoal, setCaloriesGoal] = useState(String(dailyGoals.calories));
  const [proteinGoal, setProteinGoal] = useState(String(dailyGoals.protein));
  const [carbsGoal, setCarbsGoal] = useState(String(dailyGoals.carbs));
  const [fatGoal, setFatGoal] = useState(String(dailyGoals.fat));

  const handleToggleNotifications = (value) => {
    setNotificationsEnabled(value);
    updateUserPreferences({
      notifications: {
        workouts: value,
        nutrition: user?.preferences?.notifications?.nutrition || false,
        social: user?.preferences?.notifications?.social || false,
      },
    });
  };

  const handleSaveNutritionGoals = () => {
    if (!caloriesGoal || !proteinGoal || !carbsGoal || !fatGoal) {
      Alert.alert('Error', 'Please enter all nutrition goals');
      return;
    }
    updateDailyGoals({
      calories: parseInt(caloriesGoal, 10),
      protein: parseInt(proteinGoal, 10),
      carbs: parseInt(carbsGoal, 10),
      fat: parseInt(fatGoal, 10),
    });
    Alert.alert('Success', 'Nutrition goals updated successfully');
  };

  const handleConnectSpotify = async () => {
    try {
      setIsConnecting(true);
      const success = await spotifyService.authenticateWithPopup();
      if (success) {
        Alert.alert('Success', 'Spotify connected successfully!');
      } else {
        Alert.alert('Info', 'Spotify authentication was cancelled.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to connect Spotify: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectSpotify = () => {
    Alert.alert(
      'Disconnect Spotify',
      'Are you sure you want to disconnect your Spotify account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectSpotify();
            Alert.alert('Success', 'Spotify account disconnected');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await authService.logout();
            await logout();
            router.replace('/');
          } catch (e) {
            console.error('[Settings] Logout error:', e);
            router.replace('/start');
          }
        },
      },
    ]);
  };

  const handleAbout = () => {
    Alert.alert(
      'About ZOWN HQ',
      'ZOWN HQ is a fitness app designed to help you achieve your fitness goals through personalized workouts, nutrition tracking, and progress monitoring.\n\nVersion 1.0.0',
      [{ text: 'OK' }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      'Help & Support',
      'For help and support, please contact us at support@zownhq.com or visit www.zownhq.com.',
      [{ text: 'OK' }]
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'This is a demo app. In production this would display the privacy policy.',
      [{ text: 'OK' }]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loadingText}>Loadingâ¦</Text>
      </SafeAreaView>
    );
  }

  const renderRow = (Icon, label, onPress, rightNode) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.rowIcon}>
        <Icon size={18} color={colors.text} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {rightNode ?? <ChevronRight size={18} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Settings" subtitle="PREFERENCES" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          {renderRow(
            Bell,
            'Push Notifications',
            () => handleToggleNotifications(!notificationsEnabled),
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.text }}
              thumbColor={notificationsEnabled ? colors.bg : colors.textSecondary}
            />
          )}
        </View>

        <Text style={styles.sectionLabel}>MUSIC</Text>
        <View style={styles.card}>
          {isSpotifyConnected ? (
            <>
              <View style={styles.spotifyHeader}>
                <View style={styles.spotifyInfo}>
                  <Music size={22} color={colors.spotify} />
                  <View style={{ marginLeft: spacing.md }}>
                    <Text style={styles.spotifyTitle}>Spotify Connected</Text>
                    <Text style={styles.spotifySub}>{spotifyUser?.display_name || 'Connected'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnectSpotify}>
                  <Text style={styles.disconnectBtnText}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Energy Level</Text>
                <Text style={styles.prefValue}>
                  {Math.round((musicPreferences?.energyLevel ?? 0.5) * 100)}%
                </Text>
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Tempo Range</Text>
                <Text style={styles.prefValue}>
                  {musicPreferences?.tempoRange?.min ?? 0}-{musicPreferences?.tempoRange?.max ?? 0} BPM
                </Text>
              </View>
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Explicit Content</Text>
                <Switch
                  value={!!musicPreferences?.explicitContent}
                  onValueChange={(value) => updateMusicPreferences({ explicitContent: value })}
                  trackColor={{ false: colors.border, true: colors.text }}
                  thumbColor={musicPreferences?.explicitContent ? colors.bg : colors.textSecondary}
                />
              </View>
            </>
          ) : (
            <View style={styles.spotifyConnectCard}>
              <Music size={28} color={colors.spotify} />
              <Text style={styles.spotifyConnectTitle}>Connect Spotify</Text>
              <Text style={styles.spotifyConnectDesc}>
                Play music during workouts and get personalized recommendations.
              </Text>
              <TouchableOpacity
                style={styles.connectPill}
                onPress={handleConnectSpotify}
                disabled={isConnecting}
                activeOpacity={0.85}
              >
                <Text style={styles.connectPillText}>
                  {isConnecting ? 'Connectingâ¦' : 'Connect'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>NUTRITION GOALS</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Daily Calories</Text>
            <TextInput
              style={styles.input}
              value={caloriesGoal}
              onChangeText={setCaloriesGoal}
              keyboardType="number-pad"
              placeholder="2000"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Protein (g)</Text>
            <TextInput
              style={styles.input}
              value={proteinGoal}
              onChangeText={setProteinGoal}
              keyboardType="number-pad"
              placeholder="150"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.input}
              value={carbsGoal}
              onChangeText={setCarbsGoal}
              keyboardType="number-pad"
              placeholder="200"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Fat (g)</Text>
            <TextInput
              style={styles.input}
              value={fatGoal}
              onChangeText={setFatGoal}
              keyboardType="number-pad"
              placeholder="70"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <PrimaryButton title="Save Goals" onPress={handleSaveNutritionGoals} />
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          {renderRow(Info, 'About ZOWN HQ', handleAbout)}
          <View style={styles.divider} />
          {renderRow(HelpCircle, 'Help & Support', handleHelp)}
          <View style={styles.divider} />
          {renderRow(Lock, 'Privacy Policy', handlePrivacy)}
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.85}>
            <LogOut size={18} color={colors.red} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loadingText: { ...typography.body, textAlign: 'center', marginTop: spacing.xl },

  sectionLabel: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.body, flex: 1, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },

  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotifyInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  spotifyTitle: { ...typography.body, fontWeight: '700' },
  spotifySub: { ...typography.bodySmall, marginTop: 2 },
  disconnectBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disconnectBtnText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLabel: { ...typography.body, color: colors.textSecondary },
  prefValue: { ...typography.body, fontWeight: '700' },

  spotifyConnectCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  spotifyConnectTitle: { ...typography.h3 },
  spotifyConnectDesc: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  connectPill: {
    backgroundColor: colors.spotify,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  connectPillText: { color: tokens.colors.background.default, fontWeight: '800', fontSize: 14 },

  inputGroup: { gap: 6 },
  inputLabel: { ...typography.label },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoutText: { ...typography.body, color: colors.red, fontWeight: '700' },

  versionText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
