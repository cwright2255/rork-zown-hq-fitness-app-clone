import React, { useState, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Dimensions, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';
import { logOut } from '@/lib/logOut';
import { useEntitlement } from '@/hooks/useEntitlement';
import { TIER_NAMES } from '@/lib/entitlements';
import { useSpotifyStore } from '@/store/spotifyStore';
import { useAppleMusicStore } from '@/store/appleMusicStore';
import { spotifyService } from '@/services/spotifyService';
import { setShowInLeaderboards } from '@/services/leaderboardVisibility';
import { requestAppleAuthorizationCode } from '@/services/socialAuth';
import { auth, functions } from '../../src/config/firebase';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as CachedImage } from 'expo-image';
import { meshCache } from '@/lib/meshCache';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { sendTestReport, forceTestCrash, isCrashReportingAvailable } from '@/lib/crashReporting';
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

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
    weightUnits,
    showInLeaderboards,
    coachCanAddToCalendar,
    updateSetting,
  } = useSettingsStore();

  const { user, logout } = useUserStore();
  const { isConnected: spotifyConnected, disconnectSpotify } = useSpotifyStore();
  const { isConnected: appleMusicConnected, connectAppleMusic, disconnectAppleMusic } = useAppleMusicStore();
  const uid = user?.uid;
  const { tier } = useEntitlement();

  // Real, new: explicit, visible check for OTA updates rather than relying
  // on the implicit default behavior (check + download in the background
  // on launch, apply on the *next* restart). That implicit path has no
  // visible confirmation the download genuinely completed before the app
  // gets closed again - this makes the whole process observable and
  // removes the guesswork around timing.
  const [updateCheckState, setUpdateCheckState] = useState('idle');

  // Real fix: the actual bug behind "Check for Updates" saying Up to
  // date while the app keeps running old code. expo-updates always
  // silently checks-and-downloads in the background on every cold
  // launch (confirmed directly against Expo's own docs), independent of
  // this button - by the time someone opens Settings and taps Check for
  // Updates a few seconds later, that background download can already
  // be finished. checkForUpdateAsync() then correctly reports nothing
  // NEW left on the server (isAvailable: false), so this handler used
  // to stop right there - but "nothing new to fetch" isn't the same as
  // "the running bundle is current": the already-downloaded update was
  // still sitting there, unapplied, since only reloadAsync() actually
  // applies one and nothing had called it.
  //
  // isUpdatePending, from expo-updates' own useUpdates() hook, reads
  // directly from its native state machine rather than this component's
  // own fetch calls - confirmed directly against Expo's own changelog -
  // so it goes true for a background-downloaded update too, not just
  // one this handler fetched itself. Reacting to it here (rather than
  // calling reloadAsync() only after this handler's own fetch) is what
  // actually closes the gap, including the case where it's already true
  // the moment this screen mounts.
  //
  // But the restart only happens once the person has tapped Check for
  // updates. An update that arrived in the background waits for the next
  // launch (services/appUpdates.js); it must not restart the app just
  // because Settings was opened.
  const { isUpdatePending } = Updates.useUpdates();
  const askedForUpdate = useRef(false);

  useEffect(() => {
    if (isUpdatePending && askedForUpdate.current) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  const handleCheckForUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Updates', 'OTA updates are not enabled in this build (likely running in development mode).');
      return;
    }
    askedForUpdate.current = true;
    if (isUpdatePending) {
      // Already downloaded in the background, and the person asked for it: use it now.
      try { await Updates.reloadAsync(); } catch {}
      return;
    }
    setUpdateCheckState('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateCheckState('no_update');
        setTimeout(() => setUpdateCheckState('idle'), 3000);
        return;
      }
      setUpdateCheckState('downloading');
      // reloadAsync() is intentionally not called here anymore - the
      // isUpdatePending effect above is now the single place that
      // applies a downloaded update, so this manual fetch and the
      // automatic background one both go through the same, correct path.
      await Updates.fetchUpdateAsync();
    } catch (error) {
      setUpdateCheckState('error');
      Alert.alert('Update Check Failed', error?.message || String(error));
      setTimeout(() => setUpdateCheckState('idle'), 3000);
    }
  };

  // Real fix: makeRedirectUri() with no arguments doesn't reliably
  // resolve to this app's own scheme - confirmed directly against
  // Expo's own docs, which show a zero-argument call resolving to an
  // EAS-Update-specific URL (exp://u.expo.dev/...) instead, which is
  // why Spotify was rejecting this with "redirect_uri: Not matching
  // configuration" even though zownhq://spotify-callback is already,
  // correctly registered in the Spotify Developer Dashboard. Explicitly
  // passing scheme/path makes this actually match what's registered.
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'zownhq', path: 'spotify-callback' });

  // Log redirect URI on load
  useEffect(() => {
    console.log('[Spotify] Add this redirect URI to Spotify Dashboard:', redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: 'cb884c0e045d4683bd3f0b38cb0e151e',
      scopes: [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'streaming',
        'user-library-read',
        'user-read-email',
        'user-read-private',
        'user-top-read',
        'playlist-read-private',
        'playlist-read-collaborative',
        'playlist-modify-private',
        'playlist-modify-public',
      ],
      redirectUri,
      usePKCE: true,
      responseType: 'code',
    },
    {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
    }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code, request.codeVerifier, redirectUri);
    }
  }, [response]);

  async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
    try {
      const body = 'client_id=cb884c0e045d4683bd3f0b38cb0e151e' +
        '&grant_type=authorization_code' +
        '&code=' + encodeURIComponent(code) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&code_verifier=' + encodeURIComponent(codeVerifier);
      
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await res.json();
      if (data.access_token) {
        await spotifyService.storeToken(data.access_token, data.refresh_token, data.expires_in);
        const userProfile = await spotifyService.getCurrentUser();
        useSpotifyStore.setState({
          isConnected: true,
          user: userProfile,
        });
        useSpotifyStore.getState().loadUserData();
        useSpotifyStore.getState().loadWorkoutPlaylists();
        useSpotifyStore.getState().loadRunningPlaylists();
        Alert.alert('Connected', "Successfully connected to Spotify as " + (userProfile?.display_name || 'user') + "!");
      } else {
        Alert.alert('Connection Failed', data.error_description || data.error || 'Failed to exchange token');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Token exchange failed');
    }
  }

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
        // The same function as the Log Out on the Profile page (lib/logOut.js): it signs out, then clears every store and every saved key.
        onPress: async () => {
          await logOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  // Erasing is done by the deleteMyAccount Cloud Function: it removes the person's
  // data and files from our servers and then their sign-in (and email). Only when that
  // worked is this phone cleaned up too and restarted into a signed-out state.
  const [deleting, setDeleting] = useState(false);

  const deleteAccountNow = async () => {
    setDeleting(true);

    // An account that signs in with Apple has to be disconnected from the person's Apple ID when it is deleted (App Review
    // guideline 5.1.1(v)). The server does that, but only with a fresh one-time code from Apple, so the person confirms with
    // Apple first. Nothing has been deleted yet if they close that sheet.
    const apple = (auth.currentUser?.providerData || []).find((p) => p?.providerId === 'apple.com');
    let appleAuthorizationCode;
    if (apple) {
      try {
        appleAuthorizationCode = await requestAppleAuthorizationCode(apple.uid);
      } catch (e) {
        setDeleting(false);
        if (e?.code === 'cancelled') {
          Alert.alert('Not deleted', 'To delete an account that uses Sign in with Apple, you need to confirm with Apple. Nothing was deleted.');
        } else {
          Alert.alert('Could not confirm with Apple', `${e?.message || 'Apple could not confirm it is you.'} Nothing was deleted.`);
        }
        return;
      }
    }

    try {
      await httpsCallable(functions, 'deleteMyAccount', { timeout: 540000 })(appleAuthorizationCode ? { appleAuthorizationCode } : {});
    } catch (e) {
      setDeleting(false);
      const message = String(e?.message || '');
      if (message === 'apple-code-rejected') {
        Alert.alert('Apple did not accept that', "Apple didn't accept the confirmation. Nothing was deleted. Please try again.");
      } else if (message === 'apple-wrong-account') {
        Alert.alert('A different Apple ID', "That isn't the Apple ID you signed in to ZOWN HQ with. Nothing was deleted. Use the same Apple ID and try again.");
      } else if (message === 'apple-unavailable') {
        Alert.alert('Apple is not answering', "Apple isn't answering right now. Nothing was deleted. Please try again in a few minutes.");
      } else if (message === 'apple-revoke-failed') {
        Alert.alert('Could not disconnect from Apple', "We couldn't disconnect ZOWN HQ from your Apple ID. Nothing was deleted. Please try again. If it keeps failing, email privacy@zownhq.com.");
      } else if (message === 'apple-code-required') {
        Alert.alert('Sign in with Apple again first', 'To delete an account that uses Sign in with Apple, log out, sign in with Apple again, then delete your account.');
      } else if (message === 'recent-login-required' || /failed-precondition/.test(String(e?.code))) {
        Alert.alert('Sign in again first', 'To protect your account, log out, sign back in, then delete your account.');
      } else if (message === 'delete-incomplete') {
        Alert.alert('Not finished', "We couldn't finish erasing your data. Nothing was lost, so please try again. If it keeps failing, email privacy@zownhq.com.");
      } else {
        Alert.alert('Could not delete', 'We could not reach the server. Check your connection and try again.');
      }
      return;
    }

    // The account is gone. Clear what this phone kept, then start over signed out.
    try { await signOut(auth); } catch {}
    try { await AsyncStorage.clear(); } catch {}
    try { await Promise.all([meshCache.clear(), CachedImage.clearDiskCache(), CachedImage.clearMemoryCache()]); } catch {}
    if (logout) logout();
    setDeleting(false);
    try { await Updates.reloadAsync(); } catch {}
    router.replace('/auth/login');
  };

  const handleDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      'Delete Account',
      'This permanently deletes your ZOWN HQ account and erases your email, profile, workouts, nutrition and body-scan records, posts, messages and uploaded photos from our servers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? Everything will be erased and you will not be able to sign in to this account again.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Yes, Delete', style: 'destructive', onPress: deleteAccountNow },
              ]
            );
          },
        },
      ]
    );
  };

  // Only things the app can fetch or build again: downloaded pictures and saved
  // 3D body models. Never AsyncStorage as a whole, which also holds the signed-in
  // user, settings, XP and progress, meal plan and any run or hike in progress.
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Remove downloaded images and saved 3D body models from this phone? They download or build again when needed. Your workouts, logs, settings and sign-in are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                CachedImage.clearDiskCache(),
                CachedImage.clearMemoryCache(),
                meshCache.clear(),
              ]);
              Alert.alert('Success', 'Cache cleared successfully.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Modal transparent visible={deleting} animationType="fade" onRequestClose={() => {}}>
        <View style={s.deletingOverlay} testID="deleting-overlay">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={s.deletingText}>Erasing your data...</Text>
          <Text style={s.deletingSub}>This can take a minute. Please keep the app open.</Text>
        </View>
      </Modal>
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
            onPress={() => Alert.alert('Account Email', "Your account is verified under " + (user?.email || 'no email') + ".")}
          />
          <SettingRow
            icon="ribbon-outline"
            label="Your plan"
            subLabel={`${TIER_NAMES[tier]}. See what each plan includes`}
            onPress={() => router.push('/paywall')}
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
        </View>

        {/* 3. NOTIFICATIONS */}
        {/* One switch for the reminders the app sets on this phone (services/notificationStartup.js, lib/remindersAllowed.js). The
            per-kind toggles and Quiet Hours were hidden: they were saved and nothing read them. */}
        <SectionHeader title="Notifications" />
        <View style={s.card}>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            subLabel="Calendar reminders, fasting goal alerts and cooking timers"
            right={
              <Switch
                value={notifications !== false}
                onValueChange={(v) => updateSetting('notifications', v, uid)}
                accessibilityLabel="Notifications"
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
            icon="list-outline"
            label="Show in Leaderboards"
            right={
              <Switch
                value={showInLeaderboards}
                onValueChange={(v) => setShowInLeaderboards(v, user)}
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        {/* AI COACH */}
        <SectionHeader title="AI Coach" />
        <View style={s.card}>
          <SettingRow
            icon="calendar-outline"
            label="Let the coach add to my calendar"
            subLabel="When this is off, the coach will not put workouts, runs or meals on your calendar"
            right={
              <Switch
                value={coachCanAddToCalendar !== false}
                onValueChange={(v) => updateSetting('coachCanAddToCalendar', v, uid)}
                accessibilityLabel="Let the coach add to my calendar"
                trackColor={{ true: '#000000', false: '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow
            icon="bulb-outline"
            label="What your Coach remembers"
            subLabel="See, remove or forget the notes your coach keeps about you"
            onPress={() => router.push('/profile/coach-memory')}
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
              } else if (appleMusicConnected) {
                Alert.alert(
                  'Switch Music Player',
                  'You\'re currently connected to Apple Music. Connecting Spotify will disconnect it - only one player can be connected at a time. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Continue',
                      onPress: async () => {
                        await disconnectAppleMusic();
                        Alert.alert(
                          'Spotify Redirect URI',
                          "To connect your Spotify, please register this redirect URI in Spotify Developer Dashboard:\n\n" + redirectUri + "\n\nWould you like to copy and proceed?",
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Copy & Continue',
                              onPress: async () => {
                                await Clipboard.setStringAsync(redirectUri);
                                promptAsync();
                              },
                            }
                          ]
                        );
                      },
                    }
                  ]
                );
              } else {
                Alert.alert(
                  'Spotify Redirect URI',
                  "To connect your Spotify, please register this redirect URI in Spotify Developer Dashboard:\n\n" + redirectUri + "\n\nWould you like to copy and proceed?",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Copy & Continue',
                      onPress: async () => {
                        await Clipboard.setStringAsync(redirectUri);
                        promptAsync();
                      },
                    }
                  ]
                );
              }
            }}
          />
          {Platform.OS === 'ios' && (
            <SettingRow
              icon="musical-note-outline"
              label="Apple Music"
              right={
                <View style={s.statusBadge}>
                  <View style={[s.statusDot, { backgroundColor: appleMusicConnected ? '#22C55E' : '#9E9E9E' }]} />
                  <Text style={s.statusText}>{appleMusicConnected ? 'Connected' : 'Not Connected'}</Text>
                </View>
              }
              onPress={async () => {
                if (appleMusicConnected) {
                  Alert.alert('Apple Music Connected', 'You are connected to Apple Music. Would you like to disconnect?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disconnect', style: 'destructive', onPress: () => disconnectAppleMusic() }
                  ]);
                } else if (spotifyConnected) {
                  Alert.alert(
                    'Switch Music Player',
                    'You\'re currently connected to Spotify. Connecting Apple Music will disconnect it - only one player can be connected at a time. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        onPress: async () => {
                          await disconnectSpotify();
                          const success = await connectAppleMusic();
                          if (!success) {
                            Alert.alert('Connection Failed', 'Could not connect to Apple Music. Please make sure you have an active Apple Music subscription and try again.');
                          }
                        },
                      }
                    ]
                  );
                } else {
                  const success = await connectAppleMusic();
                  if (!success) {
                    Alert.alert('Connection Failed', 'Could not connect to Apple Music. Please make sure you have an active Apple Music subscription and try again.');
                  }
                }
              }}
            />
          )}
          <SettingRow
            icon="watch-outline"
            label="Wearable Devices"
            right={
              <View style={s.statusBadge}>
                <Text style={s.statusText}>Manage</Text>
              </View>
            }
            onPress={() => router.push('/rook-connect')}
          />
        </View>

        {/* 6. DATA & STORAGE */}
        <SectionHeader title="Data & Storage" />
        <View style={s.card}>
          <SettingRow
            icon="refresh-outline"
            label="Clear Cache"
            subLabel="Free up local space by cleaning temporary files"
            onPress={handleClearCache}
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
            icon="bug-outline"
            label="Test Crash Reporting"
            subLabel="Sends a test report so we can confirm error tracking works"
            onPress={() => {
              if (!isCrashReportingAvailable()) {
                Alert.alert('Not available', 'Crash reporting is not part of this build yet.');
                return;
              }
              Alert.alert('Test Crash Reporting', 'Send a test error report, or force a test crash (the app will close).', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send test report', onPress: () => { sendTestReport(); Alert.alert('Sent', 'Test report sent. It can take a few minutes to show up.'); } },
                { text: 'Force test crash', style: 'destructive', onPress: () => forceTestCrash() },
              ]);
            }}
          />
          <SettingRow
            icon="cloud-download-outline"
            label="Current Update"
            subLabel={
              Updates.isEmbeddedLaunch
                ? 'Built-in bundle (no OTA update applied yet)'
                : `${Updates.updateId?.slice(0, 8) || 'unknown'} · ${Updates.createdAt ? Updates.createdAt.toLocaleString() : 'unknown time'}`
            }
          />
          <SettingRow
            icon="refresh-outline"
            label="Check for Updates"
            onPress={updateCheckState === 'idle' ? handleCheckForUpdate : undefined}
            right={
              updateCheckState === 'checking' ? <Text style={s.infoText}>Checking...</Text> :
              updateCheckState === 'downloading' ? <Text style={s.infoText}>Downloading...</Text> :
              updateCheckState === 'no_update' ? <Text style={s.infoText}>Up to date</Text> :
              updateCheckState === 'error' ? <Text style={[s.infoText, { color: '#FF3B30' }]}>Failed</Text> :
              undefined
            }
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push('/profile/terms')}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push('/profile/privacy-policy')}
          />
          <SettingRow
            icon="ribbon-outline"
            label="Open Source Licenses"
            onPress={() => router.push('/profile/licenses')}
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
  deletingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  deletingText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 16 },
  deletingSub: { color: '#DDDDDD', fontSize: 14, marginTop: 8, textAlign: 'center' },
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
