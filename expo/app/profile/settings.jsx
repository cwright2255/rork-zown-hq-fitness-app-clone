import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';
import { auth } from '../../src/config/firebase';
import { sendPasswordResetEmail, deleteUser, signOut } from 'firebase/auth';

function SettingRow({ icon, label, right, onPress, danger }) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#333'} />
      <Text style={[s.rowLabel, danger && { color: '#FF3B30' }]}>{label}</Text>
      {right || <Ionicons name="chevron-forward" size={18} color="#CCC" />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { notifications, darkMode, units, privacy, updateSetting, updatePrivacy } = useSettingsStore();
  const { user, logout } = useUserStore();
  const uid = user?.uid;

  const handleChangePassword = async () => {
    const email = user?.email;
    if (!email) { Alert.alert('Error', 'No email associated with this account.'); return; }
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
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        try { await signOut(auth); } catch {}
        if (logout) logout();
        router.replace('/auth/login');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.prompt ? Alert.prompt('Delete Account', 'Type DELETE to confirm. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async (text) => {
        if (text !== 'DELETE') { Alert.alert('Cancelled', 'You must type DELETE to confirm.'); return; }
        try {
          const currentUser = auth.currentUser;
          if (currentUser) await deleteUser(currentUser);
          if (logout) logout();
          router.replace('/auth/login');
        } catch (e) { Alert.alert('Error', e?.message || 'Failed to delete account. You may need to re-authenticate.'); }
      }},
    ], 'plain-text') : Alert.alert('Delete Account', 'This will permanently delete your account and all data. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) await deleteUser(currentUser);
          if (logout) logout();
          router.replace('/auth/login');
        } catch (e) { Alert.alert('Error', e?.message || 'Failed to delete account.'); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={s.sectionLabel}>Preferences</Text>
        <SettingRow icon="notifications-outline" label="Notifications" right={
          <Switch value={notifications} onValueChange={(v) => updateSetting('notifications', v, uid)} trackColor={{ true: '#000' }} />
        } />
        <SettingRow icon="moon-outline" label="Dark Mode" right={
          <Switch value={darkMode} onValueChange={(v) => updateSetting('darkMode', v, uid)} trackColor={{ true: '#000' }} />
        } />
        <SettingRow icon="speedometer-outline" label={'Units: ' + (units === 'imperial' ? 'Imperial' : 'Metric')} onPress={() => updateSetting('units', units === 'imperial' ? 'metric' : 'imperial', uid)} />
        <SettingRow icon="language-outline" label="Language" onPress={() => Alert.alert('Coming Soon', 'Language settings will be available in a future update.')} />

        <Text style={s.sectionLabel}>Account</Text>
        <SettingRow icon="lock-closed-outline" label="Change Password" onPress={handleChangePassword} />
        <SettingRow icon="mail-outline" label="Email Preferences" onPress={() => Alert.alert('Coming Soon', 'Email preferences will be available soon.')} />
        <SettingRow icon="eye-outline" label="Privacy" right={
          <Switch value={privacy?.profilePublic} onValueChange={(v) => updatePrivacy('profilePublic', v, uid)} trackColor={{ true: '#000' }} />
        } />

        <Text style={s.sectionLabel}>Connected Services</Text>
        <SettingRow icon="musical-notes-outline" label="Spotify" right={<Text style={{ fontSize: 13, color: '#22C55E', fontWeight: '600' }}>Connected</Text>} />
        <SettingRow icon="heart-outline" label="Apple Health" onPress={() => Alert.alert('Coming Soon', 'Apple Health integration coming soon.')} />
        <SettingRow icon="watch-outline" label="Fitbit" onPress={() => Alert.alert('Coming Soon', 'Fitbit integration coming soon.')} />
        <SettingRow icon="fitness-outline" label="Garmin" onPress={() => Alert.alert('Coming Soon', 'Garmin integration coming soon.')} />

        <Text style={s.sectionLabel}>Danger Zone</Text>
        <SettingRow icon="log-out-outline" label="Log Out" danger onPress={handleLogout} />
        <SettingRow icon="trash-outline" label="Delete Account" danger onPress={handleDeleteAccount} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#000' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#999', textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#000', marginLeft: 12 },
});
