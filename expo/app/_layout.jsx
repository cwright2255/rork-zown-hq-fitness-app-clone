import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LottieView from 'lottie-react-native';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { tokens } from '../../theme/tokens';

// A custom `export class ErrorBoundary` from app/_layout.jsx has been
// removed here multiple times this session and keeps regressing back in
// from an external process editing this repo independently. Removed
// again for the same real reason as before: it doesn't match Expo
// Router's actual API for this export (a plain function receiving
// { error, retry } as props, not a self-managed class), and matches a
// real, documented pattern of ErrorBoundary-in-root-layout causing
// unexpected screen resets in Expo Router specifically.

import { Stack, usePathname, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const Head = ({ children }) => null;
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { initCrashReporting, setCrashUser, logBreadcrumb } from '@/lib/crashReporting';
import { setAnalyticsUser, logScreenView, screenNameOf } from '@/src/services/analytics';
import { fetchUpdateForNextLaunch } from '@/services/appUpdates';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useHealthStore } from '@/store/healthStore';
import { useRecipeStore } from '@/store/recipeStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
// Registers the background GPS task for run recording; it must be loaded at app start.
import '@/services/runTracking';
import { useSettingsStore } from '@/store/settingsStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useCalendarInviteStore } from '@/store/calendarInviteStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { reconcileReminders } from '@/services/calendarReminders';
import { startNotifications } from '@/services/notificationStartup';
import { startXpSync, stopXpSync } from '@/services/xpSync';
import { startProgressSync, stopProgressSync } from '@/services/progressSync';
import { publishMyProfile } from '@/services/leaderboardVisibility';
import { useShopStore } from '@/store/shopStore';
import BottomNavigation from '@/components/BottomNavigation';
import HikeRecoveryPrompt from '@/components/HikeRecoveryPrompt';
import * as Linking from 'expo-linking';
import { useSpotifyStore } from '@/store/spotifyStore';
import { auth, isFirebaseConfigured } from '../src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Constants from 'expo-constants';

void SplashScreen.preventAutoHideAsync();

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';




const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1
    }
  }
});

// Inner component ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ rendered INSIDE expo-router's navigation context
// so usePathname() and router hooks are safe to call here.
function RootLayoutInner() {
  const pathname = usePathname();
  const { isOnboarded } = useUserStore();

  // Crash reporting: start it, tag reports with the signed-in user's uid,
  // and leave a trail of screens so a crash report shows where it happened.
  const crashUid = useUserStore((s) => s.user?.uid);
  useEffect(() => { initCrashReporting(); }, []);
  // Show a notification that arrives while the app is open, and follow the Notifications switch in Settings.
  useEffect(() => { startNotifications(); }, []);
  useEffect(() => { if (crashUid) setCrashUser(crashUid); }, [crashUid]);
  useEffect(() => { logBreadcrumb(`screen: ${pathname}`); }, [pathname]);
  // The same uid goes to analytics so its events are counted per person. It is cleared when they sign out (no uid).
  useEffect(() => { setAnalyticsUser(crashUid); }, [crashUid]);
  // Where people go: one screen_view each time the screen changes, named by the route ("workout/[id]"), never by what is in it.
  const screenName = screenNameOf(useSegments());
  useEffect(() => { logScreenView(screenName); }, [screenName]);
  const { cart } = useShopStore();
  const { connectSpotify, connectSpotifyImplicit } = useSpotifyStore();

  const { loadProfile, saveProfile } = useUserStore();
  const { loadXP } = useExpStore();
  const { loadWorkouts } = useWorkoutStore();
  const { loadAllHealth } = useHealthStore();
  const { loadRecipes } = useRecipeStore();
  const { loadRuns } = useRunningStore();
  const loadCompletedHikes = useHikingStore((s) => s.loadCompletedHikes);
  const { loadSettings } = useSettingsStore();
  const [storesReady, setStoresReady] = useState(false);

  // Initialize all stores when Firebase auth resolves
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setStoresReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        // The person's plan (Free, Pro or Legend) is followed from the start, so locks and limits are right as soon as a screen opens.
        useEntitlementStore.getState().startListening(uid);
        try {
          await Promise.all([
            loadProfile(uid),
            loadXP(uid),
            loadWorkouts(uid),
            loadAllHealth(uid),
            loadRecipes(uid),
            loadRuns(uid),
            loadCompletedHikes(uid),
            loadSettings(uid),
          ]);
        } catch (e) {
          console.warn('[Layout] Store init error:', e?.message);
        }
        // XP is the server's (functions/src/xpLedger.js): follow its ledger, and put the person's name and picture on their leaderboard
        // entry. After the stores load, because the workout, run and hike records give the days that carry a streak over.
        startXpSync(uid);
        // The lifetime workout totals, the achievements and badges earned and the Battle Pass tiers claimed are the server's too: follow them.
        startProgressSync(uid);
        publishMyProfile({ user: useUserStore.getState().user });
        // The calendar is merged with its cloud copy, then the phone's reminders are set from it (the next ones come due as
        // days pass, so this is done each time the app opens). The app does not wait for either.
        useScheduleStore.getState().startSync(uid).then(() => reconcileReminders()).catch(() => undefined);
        // Calendar invitations other people send arrive through this listener (the Calendar and the Next Up card read them).
        useCalendarInviteStore.getState().subscribe(uid);
      } else {
        stopXpSync();
        stopProgressSync();
        useEntitlementStore.getState().stopListening();
        useCalendarInviteStore.getState().unsubscribe();
      }
      setStoresReady(true);
    });
    return () => unsubscribe();
  }, []);


  const cartItemCount = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);

  const handleDeepLink = useCallback(
    (event) => {
      const url = event.url;
      setTimeout(() => {
        void (async () => {
          if (!url) return;
          try {
            const parsed = Linking.parse(url);
            const authCode = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
            const fragment = url.includes('#') ? url.substring(url.indexOf('#')) : undefined;
            if (fragment?.includes('access_token')) {
              await connectSpotifyImplicit(fragment);
            } else if (authCode) {
              await connectSpotify(authCode);
            }
          } catch (error) {
            console.error('Error handling Spotify deep link:', error);
          }
        })();
      }, 0);
    },
    [connectSpotify, connectSpotifyImplicit]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL()
      .then((url) => { if (url) handleDeepLink({ url }); })
      .catch(console.error);
    return () => subscription.remove();
  }, [handleDeepLink]);

  useEffect(() => {
    if (pathname === '/' || pathname === '/index' || pathname === '/start' || pathname.startsWith('/auth/') || pathname === '/spotify-callback') return;
    const navigationFrame = requestAnimationFrame(() => {
      if (!isOnboarded && pathname !== '/start' && !pathname.startsWith('/auth/') && pathname !== '/' && pathname !== '/spotify-callback') {
        if (pathname !== '/onboarding') {
          import('expo-router').then(({ router }) => router.replace('/onboarding')).catch(console.error);
        }
      } else if (isOnboarded && pathname === '/start') {
        import('expo-router').then(({ router }) => router.replace('/hq')).catch(console.error);
      }
    });
    return () => cancelAnimationFrame(navigationFrame);
  }, [isOnboarded, pathname]);
  return (
    <View style={styles.container}>
      {/* A hike that was being recorded when the app was last closed: asks what to do with it. */}
      <HikeRecoveryPrompt enabled={isOnboarded} />
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background }
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="start" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="hq" />
        <Stack.Screen name="workouts" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="community" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="messaging" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="rook-connect" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="recipes" />
        <Stack.Screen name="exp-dashboard" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="exercise/index" />
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/create" />
        <Stack.Screen name="workout/complete" />
        <Stack.Screen name="workout/form-check" />
        <Stack.Screen name="body-scan/capture" />
        <Stack.Screen name="body-scan/[id]" />
        <Stack.Screen name="body-scan/compare" />
        <Stack.Screen name="recipes/import-from-share" />
        <Stack.Screen name="running/[id]" />
        <Stack.Screen name="running/active" />
        <Stack.Screen name="running/program/index" />
        <Stack.Screen name="running/program/[id]" />
        <Stack.Screen name="running/session/[id]" />
        <Stack.Screen name="running/run/[id]" />
        <Stack.Screen name="running/import" />
        <Stack.Screen name="running/hiking/index" />
        <Stack.Screen name="running/hiking/[id]" />
        <Stack.Screen name="running/hiking/saved" />
        <Stack.Screen name="running/hiking/monitor" />
        <Stack.Screen name="running/hiking/history" />
        <Stack.Screen name="running/hiking/log/[id]" />
        <Stack.Screen name="running/races/index" />
        <Stack.Screen name="running/races/[kind]" />
        <Stack.Screen name="running/journeys/[id]" />
        <Stack.Screen name="nutrition/search" />
        <Stack.Screen name="nutrition/food/[id]" />
        <Stack.Screen name="shop/product/[id]" />
        <Stack.Screen name="shop/cart" />
        <Stack.Screen name="shop/collection/[id]" />
        <Stack.Screen name="shop/category/[category]" />
        <Stack.Screen name="profile/achievements" />
        <Stack.Screen name="profile/streak" />
        <Stack.Screen name="profile/settings" />
        <Stack.Screen name="profile/workout-history" />
        <Stack.Screen name="profile/calorie-history" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="spotify-integration" />
        <Stack.Screen name="spotify-redirect" />
        <Stack.Screen name="spotify-callback" />
      </Stack>

        {/* Floating bottom tab bar */}
        {!pathname.startsWith('/auth/') && pathname !== '/start' && pathname !== '/' && pathname !== '/index' && !/^\/workout\/.+$/.test(pathname) && !/^\/running\/(?!program)[^/]+$/.test(pathname) && !pathname.startsWith('/body-scan') && !pathname.startsWith('/messages') && !pathname.startsWith('/profile/edit') && !pathname.startsWith('/profile/settings') && !pathname.startsWith('/profile/terms') && !pathname.startsWith('/profile/privacy-policy') && !pathname.startsWith('/profile/licenses') && !pathname.startsWith('/profile/running-log') && !pathname.startsWith('/profile/workout-history') && !pathname.startsWith('/profile/calorie-history') && !pathname.startsWith('/running/hiking') && !pathname.startsWith('/running/run/') && !pathname.startsWith('/running/races/') && !pathname.startsWith('/running/journeys/') && !pathname.startsWith('/profile/notifications') && !pathname.startsWith('/profile/help') && !pathname.startsWith('/coach') && !pathname.startsWith('/shop/product') && !pathname.startsWith('/shop/cart') && !pathname.startsWith('/shop/try-on') && !pathname.startsWith('/nutrition/scan') && !pathname.startsWith('/nutrition/barcode-scan') && !pathname.startsWith('/paywall') && <BottomNavigation />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // A new version of the app is downloaded in the background and used the next time the app is opened from scratch. It must not
  // restart the app that is open: this runs at every launch, while Home is already usable, and a restart then loses what the
  // person has started (services/appUpdates.js says more). Never fails startup.
  useEffect(() => {
    void fetchUpdateForNextLaunch();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootLayoutInner />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 1000
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cartButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  }
});

