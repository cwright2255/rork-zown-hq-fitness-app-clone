import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View, Animated, Image } from 'react-native';
import { tokens } from '../../theme/tokens';

// CRITICAL: ErrorBoundary is exported FIRST ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ before any other imports that could
// throw at module-load time. expo-router reads `routeModule.ErrorBoundary` when
// loading this route, and if any later top-level import/execution fails,
// the rest of the module never runs. Defining ErrorBoundary here guarantees
// the export exists no matter what else happens below.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ZownHQ] Crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: tokens.colors.dark_navy.text_primary }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: tokens.colors.dark_navy.bg_primary }}>Something went wrong</Text>
          <Text style={{ color: tokens.colors.dark_navy.text_muted, textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
            {String(this.state.error)}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: tokens.colors.dark_navy.bg_primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 28 }}>
            <Text style={{ color: tokens.colors.dark_navy.text_primary, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const Head = ({ children }) => null;
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useHealthStore } from '@/store/healthStore';
import { useRecipesStore } from '@/store/recipesStore';
import { useRunningStore } from '@/store/runningStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useShopStore } from '@/store/shopStore';
import BottomNavigation from '@/components/BottomNavigation';
import * as Linking from 'expo-linking';
import { processAdminLink } from '@/services/remoteAdminService';
import { useSpotifyStore } from '@/store/spotifyStore';
import { auth, isFirebaseConfigured } from '../src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Constants from 'expo-constants';
import { ROOK_CONFIG } from '../src/services/wearables';

void SplashScreen.preventAutoHideAsync();

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function RookWrapper({ children }) {
  if (IS_EXPO_GO) return children;
  try {
    const { RookSyncGate } = require('react-native-rook-sdk');
    return (
      <RookSyncGate
        environment={ROOK_CONFIG.environment}
        clientUUID={ROOK_CONFIG.clientUUID}
        secret={ROOK_CONFIG.secret}
        enableLogs={__DEV__}
        enableBackgroundSync={false}>
        
        {children}
      </RookSyncGate>);

  } catch (e) {
    console.log('[ROOK] SDK not available, running without wearables:', e.message);
    return children;
  }
}



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

function SplashAnimation({ onFinish }) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  
  // Base values for logo
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoTranslateX = useRef(new Animated.Value(0)).current;
  
  // RGB channel split animations
  const redTranslateX = useRef(new Animated.Value(0)).current;
  const blueTranslateX = useRef(new Animated.Value(0)).current;
  const redOpacity = useRef(new Animated.Value(0)).current;
  const blueOpacity = useRef(new Animated.Value(0)).current;
  
  // Text animation
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Initial fade-in of the central logo
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Fade in the subtitle text shortly after
      Animated.timing(textOpacity, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Trigger sequence of glitches between 0.5s and 2.2s
      const runGlitch = (delay, duration, shift, splitShift, opacityFlicker = false) => {
        return setTimeout(() => {
          // Perform horizontal shift of central logo
          Animated.sequence([
            Animated.timing(logoTranslateX, { toValue: shift, duration: duration / 2, useNativeDriver: true }),
            Animated.timing(logoTranslateX, { toValue: -shift / 2, duration: duration / 2, useNativeDriver: true }),
            Animated.timing(logoTranslateX, { toValue: 0, duration: 50, useNativeDriver: true })
          ]).start();

          // Move the RGB channel split duplicates
          redTranslateX.setValue(-splitShift);
          blueTranslateX.setValue(splitShift);
          redOpacity.setValue(0.7);
          blueOpacity.setValue(0.7);

          if (opacityFlicker) {
            logoOpacity.setValue(0.3);
            textOpacity.setValue(0.2);
          }

          setTimeout(() => {
            redOpacity.setValue(0);
            blueOpacity.setValue(0);
            if (opacityFlicker) {
              logoOpacity.setValue(1);
              textOpacity.setValue(0.8);
            }
          }, duration);
        }, delay);
      };

      // Timeline of multiple rapid glitch events
      const t1 = runGlitch(200, 80, 15, 25, true);    // Early quick glitch
      const t2 = runGlitch(600, 120, -12, -20, false); // Minor glitch
      const t3 = runGlitch(1100, 60, 25, 35, true);   // Extreme fast glitch
      const t4 = runGlitch(1200, 100, -8, -12, false); // Instant recovery echo
      const t5 = runGlitch(1700, 150, 18, 28, true);   // Pre-exit heavy glitch

      // 2. After 2.1 seconds, initiate final fade out of everything
      const exitTimeout = setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 2100);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
        clearTimeout(exitTimeout);
      };
    });
  }, []);

  return (
    <Animated.View style={[
      StyleSheet.absoluteFill,
      { 
        backgroundColor: '#000000', 
        zIndex: 9999, 
        justifyContent: 'center', 
        alignItems: 'center',
        opacity: containerOpacity
      }
    ]}>
      {/* Container for logo glitch layers */}
      <View style={{ width: 140, height: 140, justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Red Tint Channel Split Duplicate */}
        <Animated.View style={{
          position: 'absolute',
          opacity: redOpacity,
          transform: [{ translateX: redTranslateX }, { scale: logoScale }],
        }}>
          <Image
            source={require('../assets/branding/zown-logo-512.png')}
            style={{ width: 140, height: 140, resizeMode: 'contain', tintColor: '#FF0055' }}
          />
        </Animated.View>

        {/* Blue/Cyan Tint Channel Split Duplicate */}
        <Animated.View style={{
          position: 'absolute',
          opacity: blueOpacity,
          transform: [{ translateX: blueTranslateX }, { scale: logoScale }],
        }}>
          <Image
            source={require('../assets/branding/zown-logo-512.png')}
            style={{ width: 140, height: 140, resizeMode: 'contain', tintColor: '#00FFFF' }}
          />
        </Animated.View>

        {/* Central Base Logo */}
        <Animated.View style={{
          opacity: logoOpacity,
          transform: [{ translateX: logoTranslateX }, { scale: logoScale }],
        }}>
          <Image
            source={require('../assets/branding/zown-logo-512.png')}
            style={{ width: 140, height: 140, resizeMode: 'contain' }}
          />
        </Animated.View>

      </View>

      {/* Subtitle "OWN THE DAY" with matching slight opacity shift */}
      <Animated.View style={{ opacity: textOpacity, marginTop: 24, transform: [{ translateX: logoTranslateX }] }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 4 }}>
          OWN THE DAY
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function RootLayoutInner() {
  const [splashVisible, setSplashVisible] = useState(true);
  const pathname = usePathname();
  const { isOnboarded } = useUserStore();
  const { cart } = useShopStore();
  const { connectSpotify, connectSpotifyImplicit } = useSpotifyStore();

  const { loadProfile, saveProfile } = useUserStore();
  const { loadXP } = useExpStore();
  const { loadWorkouts } = useWorkoutStore();
  const { loadAllHealth } = useHealthStore();
  const { loadRecipes } = useRecipesStore();
  const { loadRuns } = useRunningStore();
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
        try {
          await Promise.all([
            loadProfile(uid),
            loadXP(uid),
            loadWorkouts(uid),
            loadAllHealth(uid),
            loadRecipes(uid),
            loadRuns(uid),
            loadSettings(uid),
          ]);
        } catch (e) {
          console.warn('[Layout] Store init error:', e?.message);
        }
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
          try {
            const result = await processAdminLink(url);
            if (result.handled) console.log('[AdminLink] Command handled:', result.message);
          } catch {
            console.log('[AdminLink] No admin command in link');
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
      {splashVisible && <SplashAnimation onFinish={() => setSplashVisible(false)} />}
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
        <Stack.Screen name="telehealth" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="messaging" />
        <Stack.Screen name="mood-tracking" />
        <Stack.Screen name="health-assessment" />
        <Stack.Screen name="wearables" />
        <Stack.Screen name="rook-connect" />
        <Stack.Screen name="support" />
        <Stack.Screen name="order-tracking" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="recipes" />
        <Stack.Screen name="champion-pass" />
        <Stack.Screen name="exp-dashboard" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/create" />
        <Stack.Screen name="nutrition/search" />
        <Stack.Screen name="nutrition/food/[id]" />
        <Stack.Screen name="shop/product/[id]" />
        <Stack.Screen name="shop/cart" />
        <Stack.Screen name="shop/collection/[id]" />
        <Stack.Screen name="shop/category/[category]" />
        <Stack.Screen name="profile/achievements" />
        <Stack.Screen name="profile/progress" />
        <Stack.Screen name="profile/settings" />
        <Stack.Screen name="profile/body-scan" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" />
        <Stack.Screen name="spotify-integration" />
        <Stack.Screen name="spotify-redirect" />
        <Stack.Screen name="spotify-callback" />
      </Stack>

        {/* Floating bottom tab bar */}
        {!pathname.startsWith('/auth/') && pathname !== '/start' && pathname !== '/' && pathname !== '/index' && !/^\/workout\/.+$/.test(pathname) && !/^\/running\/(?!program)[^/]+$/.test(pathname) && pathname !== '/body-scan' && !pathname.startsWith('/messages') && !pathname.startsWith('/profile/edit') && !pathname.startsWith('/profile/settings') && !pathname.startsWith('/profile/terms') && !pathname.startsWith('/profile/privacy-policy') && !pathname.startsWith('/profile/licenses') && !pathname.startsWith('/profile/running-log') && !pathname.startsWith('/profile/notifications') && !pathname.startsWith('/profile/help') && !pathname.startsWith('/shop/product') && !pathname.startsWith('/shop/cart') && !pathname.startsWith('/shop/try-on') && !pathname.startsWith('/nutrition/meal') && <BottomNavigation />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <RookWrapper>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <SafeAreaProvider>
            <RootLayoutInner />
          </SafeAreaProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </RookWrapper>
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

