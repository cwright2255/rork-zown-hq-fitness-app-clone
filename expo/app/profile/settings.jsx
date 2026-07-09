import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { auth } from '../../src/config/firebase';
import { sendPasswordResetEmail, deleteUser, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../../../theme/tokens';

const { width } = Dimensions.get('window');

// Custom inline Segmented Control matching the White/Black theme perfectly
function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={s.segmentContainer}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[s.segmentBtn, isActive && s.segmentBtnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[s.segmentText, isActive && s.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={s.sectionLabel}>{title}</Text>;
}

function SettingRow({ icon, label, right, onPress, subLabel, danger }) {
  return (
    <Pressable style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={s.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#000000'} />
        <View style={s.labelContainer}>
          <Text style={[s.rowLabel, danger && { color: '#FF3B30', fontWeight: '600' }]}>{label}</Text>
          {subLabel && <Text style={s.rowSubLabel}>{subLabel}</Text>}
        </View>
      </View>
      <View style={s.rowRight}>
        {right !== undefined ? (
          right
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const {
    notifications,
    darkMode,
    units,
    language,
    privacy,
    weightUnits,
    temperatureUnits,
    startOfWeek,
    workoutReminders,
    achievementAlerts,
    socialActivity,
    weeklySummary,
    showInLeaderboards,
    allowFriendRequests,
    updateSetting,
    updatePrivacy,
  } = useSettingsStore();

  const { user, logout } = useUserStore();
  const { isConnected: spotifyConnected, connectSpotifyImplicit, disconnectSpotify } = useSpotifyStore();
  const uid = user?.uid;

  const handleChangePassword = async () => {
    const email = user?.email;
    if (!email) {
      Alert.alert('Error', 'No email associated with this account.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Email Sent', 'A password reset link has been sent to ' + email);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to send reset email.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch {}
          if (logout) logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? All data will be lost forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const currentUser = auth.currentUser;
                      if (currentUser) {
                        await deleteUser(currentUser);
                      }
                      if (logout) logout();
                      router.replace('/auth/login');
                    } catch (e) {
                      Alert.alert(
                        'Error',
                        e?.message || 'Failed to delete account. Please log in again and retry.'
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'Are you sure you want to clear cached image and workout data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            Alert.alert('Success', 'Cache cleared successfully.');
          } catch (e) {
            Alert.alert('Error', 'Failed to clear cache.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </Pressable>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. ACCOUNT */}
        <SectionHeader title="Account" />
        <View style={s.card}>
          <SettingRow
            icon="person-outline"
            label="Profile"
            subLabel="Edit your physical attributes and goals"
            onPress={() => router.push('/profile/edit')}
          />
          <SettingRow
            icon="mail-outline"
            label="Email"
            subLabel={user?.email || 'Not logged in'}
            onPress={() => Alert.alert('Account Email', `Your account is verified under ${user?.email || 'no email'}.`)}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Change Password"
            subLabel="Reset your password secure link"
            onPress={handleChangePassword}
          />
        </View>

        {/* 2. UNITS & PREFERENCES */}
        <SectionHeader title="Units & Preferences" />
        <View style={s.card}>
          <SettingRow
            icon="trail-sign-outline"
            label="Distance Units"
            right={
              <SegmentedControl
                options={[
                  { label: 'mi', value: 'imperial' },
                  { label: 'km', value: 'metric' },
                ]}
                value={units}
                onChange={(val) => updateSetting('units', val, uid)}
              />
            }
          />
          <SettingRow
            icon="scale-outline"
            label="Weight Units"
            right={
              <SegmentedControl
                options={[
                  { label: 'lbs', value: 'imperial' },
                  { label: 'kg', value: 'metric' },
                ]}
                value={weightUnits}
                onChange={(val) => updateSetting('weightUnits', val, uid)}
              />
            }
          />
          <SettingRow
            icon="thermometer-outline"
            label="Temperature"
            right={
              <SegmentedControl
                options={[
                  { label: 'Â°F', value: 'fahrenheit' },
                  { label: 'Â°C', value: 'celsius' },
                ]}
                value={temperatureUnits}
                onChange={(val) => updateSetting('temperatureUnits', val, uid)}
              />
            }
          />
          <SettingRow
            icon="calendar-outline"
            label="Start of Week"
            right={
              <SegmentedControl
                options={[
                  { label: 'Mon', value: 'monday' },
                  { label: 'Sun', value: 'sunday' },
                ]}
                value={startOfWeek}
                onChange={(val) => updateSetting('startOfWeek', val, uid)}
              />
            }
          />
        </View>

        {/* 3. NOTIFICATIONS */}
        <SectionHeader title="Notifications" />
        <View style={s.card}>
          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            right={
              <Switch
                value={notifications}
                onValueChange={(v) => updateSetting('notifications', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="time-outline"
            label="Workout Reminders"
            right={
              <Switch
                value={workoutReminders}
                onValueChange={(v) => updateSetting('workoutReminders', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="trophy-outline"
            label="Achievement Alerts"
            right={
              <Switch
                value={achievementAlerts}
                onValueChange={(v) => updateSetting('achievementAlerts', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="people-outline"
            label="Social Activity"
            right={
              <Switch
                value={socialActivity}
                onValueChange={(v) => updateSetting('socialActivity', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="bar-chart-outline"
            label="Weekly Summary"
            right={
              <Switch
                value={weeklySummary}
                onValueChange={(v) => updateSetting('weeklySummary', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* 4. PRIVACY */}
        <SectionHeader title="Privacy" />
        <View style={s.card}>
          <SettingRow
            icon="eye-outline"
            label="Profile Visibility"
            subLabel="Allow anyone to view your feed posts"
            right={
              <Switch
                value={privacy?.profilePublic}
                onValueChange={(v) => updatePrivacy('profilePublic', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="share-social-outline"
            label="Activity Sharing"
            subLabel="Automatically share completed workouts"
            right={
              <Switch
                value={privacy?.activitySharing}
                onValueChange={(v) => updatePrivacy('activitySharing', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="list-outline"
            label="Show in Leaderboards"
            right={
              <Switch
                value={showInLeaderboards}
                onValueChange={(v) => updateSetting('showInLeaderboards', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="person-add-outline"
            label="Allow Friend Requests"
            right={
              <Switch
                value={allowFriendRequests}
                onValueChange={(v) => updateSetting('allowFriendRequests', v, uid)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* 5. CONNECTED SERVICES */}
        <SectionHeader title="Connected Services" />
        <View style={s.card}>
          <SettingRow
            icon="musical-notes-outline"
            label="Spotify"
            right={
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: spotifyConnected ? '#22C55E' : '#9E9E9E' }]} />
                <Text style={s.statusText}>{spotifyConnected ? 'Connected' : 'Not Connected'}</Text>
              </View>
            }
            onPress={() => {
              if (spotifyConnected) {
                Alert.alert('Spotify Connected', 'You are connected to Spotify. Would you like to disconnect?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Disconnect', style: 'destructive', onPress: () => disconnectSpotify() }
                ]);
              } else {
                connectSpotifyImplicit();
              }
            }}
          />
          <SettingRow
            icon="heart-outline"
            label="Apple Health / Google Fit"
            right={
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: '#22C55E' }]} />
                <Text style={s.statusText}>Connected</Text>
              </View>
            }
            onPress={() => Alert.alert('Native Integration', 'Apple Health and Google Fit sync automatically on production devices.')}
          />
          <SettingRow
            icon="watch-outline"
            label="Fitbit"
            right={
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: '#9E9E9E' }]} />
                <Text style={s.statusText}>Not Connected</Text>
              </View>
            }
            onPress={() => Alert.alert('Coming Soon', 'Fitbit integration is coming soon!')}
          />
          <SettingRow
            icon="fitness-outline"
            label="Garmin"
            right={
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: '#9E9E9E' }]} />
                <Text style={s.statusText}>Not Connected</Text>
              </View>
            }
            onPress={() => Alert.alert('Coming Soon', 'Garmin sync is in development.')}
          />
          <SettingRow
            icon="pulse-outline"
            label="Strava"
            right={
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: '#9E9E9E' }]} />
                <Text style={s.statusText}>Not Connected</Text>
              </View>
            }
            onPress={() => Alert.alert('Coming Soon', 'Strava integration is coming soon!')}
          />
        </View>

        {/* 6. DATA & STORAGE */}
        <SectionHeader title="Data & Storage" />
        <View style={s.card}>
          <SettingRow
            icon="cloud-download-outline"
            label="Export Data"
            subLabel="Download all personal records and activity logs"
            onPress={() => Alert.alert('Export Data', 'Your data export will be sent to your email shortly.')}
          />
          <SettingRow
            icon="refresh-outline"
            label="Clear Cache"
            subLabel="Free up local space by cleaning temporary files"
            onPress={handleClearCache}
          />
          <SettingRow
            icon="save-outline"
            label="Storage Used"
            right={<Text style={s.infoText}>14.2 MB</Text>}
          />
        </View>

        {/* 7. ABOUT */}
        <SectionHeader title="About" />
        <View style={s.card}>
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            right={<Text style={s.infoText}>ZOWN HQ v1.0.0</Text>}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => Alert.alert('Terms of Service', 'Placeholder for Terms of Service.')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => Alert.alert('Privacy Policy', 'Placeholder for Privacy Policy.')}
          />
          <SettingRow
            icon="ribbon-outline"
            label="Open Source Licenses"
            onPress={() => Alert.alert('Licenses', 'This app utilizes open source React Native and Expo components.')}
          />
          <SettingRow
            icon="star-outline"
            label="Rate App"
            onPress={() => Alert.alert('Rate App', 'Thank you for supporting ZOWN! Redirecting to app store...')}
          />
        </View>

        {/* 8. DANGER ZONE */}
        <SectionHeader title="Danger Zone" />
        <View style={[s.card, s.dangerCard]}>
          <SettingRow
            icon="log-out-outline"
            label="Log Out"
            danger
            onPress={handleLogout}
          />
          <SettingRow
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={handleDeleteAccount}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  dangerCard: {
    borderColor: '#FFD2D2',
    backgroundColor: '#FFF8F8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  labelContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  rowSubLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  rowRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  infoText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
  },
  // Custom segment style
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 2,
    width: 110,
    height: 32,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#000000',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
