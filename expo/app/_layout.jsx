import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bell, Menu, ShoppingCart } from 'lucide-react-native';
// expo-router/head not available in this SDK version — web-only feature
const Head = ({ children }) => null;
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useShopStore } from '@/store/shopStore';
import HamburgerMenu from '@/components/HamburgerMenu';
import * as Linking from 'expo-linking';
import { processAdminLink } from '@/services/remoteAdminService';
import { useSpotifyStore } from '@/store/spotifyStore';
import Constants from 'expo-constants';
import { ROOK_CONFIG } from '../src/services/wearables';

void SplashScreen.preventAutoHideAsync();

const IS_EXPO_GO = Constants.appOwnership === 'expo';

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

const TypedHamburgerMenu = HamburgerMenu;

const RootLayoutNav = React.memo(function RootLayoutNav({
  toggleMenu,
  pathname,
  cartItemCount,
  isOnboarded
}) {
  const isShopPage = useMemo(() => pathname === '/shop' || pathname.startsWith('/shop/'), [pathname]);

  const shouldShowNav = useMemo(
    () => isOnboarded && pathname !== '/onboarding' && !pathname.startsWith('/auth/') && pathname !== '/index' && pathname !== '/start' && pathname !== '/workout/active',
    [isOnboarded, pathname]
  );

  const handleMenuPress = useCallback(() => {
    toggleMenu();
  }, [toggleMenu]);

  if (!shouldShowNav) {
    return null;
  }

  return (
    <View style={styles.navContainer}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={handleMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        testID="open-menu-button">
        
        <Menu size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.navActions}>
        <TouchableOpacity style={styles.navButton} accessibilityRole="button" accessibilityLabel="Notifications" testID="notifications-button">
          <Bell size={24} color={Colors.text.primary} />
        </TouchableOpacity>

        {isShopPage ?
        <TouchableOpacity
          style={styles.cartButton}
          accessibilityRole="button"
          accessibilityLabel={`Shopping cart with ${cartItemCount} items`}
          testID="cart-button">
          
            <ShoppingCart size={24} color={Colors.text.primary} />
            {cartItemCount > 0 ?
          <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount.toString()}</Text>
              </View> :
          null}
          </TouchableOpacity> :
        null}
      </View>
    </View>);

});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1
    }
  }
});

export default function RootLayout() {
  const pathname = usePathname();
  const { isOnboarded } = useUserStore();
  const { cart } = useShopStore();
  const { connectSpotify, connectSpotifyImplicit } = useSpotifyStore();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [fontsLoaded] = useFonts({});

  const cartItemCount = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleDeepLink = useCallback(
    (event) => {
      const url = event.url;
      setTimeout(() => {
        void (async () => {
          if (!url) {
            return;
          }

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
            if (result.handled) {
              console.log('[AdminLink] Command handled:', result.message);
            }
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

    Linking.getInitialURL().
    then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    }).
    catch(console.error);

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    if (pathname === '/' || pathname === '/index' || pathname === '/start' || pathname.startsWith('/auth/') || pathname === '/spotify-callback') {
      return;
    }

    const navigationFrame = requestAnimationFrame(() => {
      if (!isOnboarded && pathname !== '/start' && !pathname.startsWith('/auth/') && pathname !== '/' && pathname !== '/spotify-callback') {
        if (pathname !== '/onboarding') {
          import('expo-router').
          then(({ router }) => {
            router.replace('/start');
          }).
          catch(console.error);
        }
      } else if (isOnboarded && pathname === '/start') {
        import('expo-router').
        then(({ router }) => {
          router.replace('/hq');
        }).
        catch(console.error);
      }
    });

    return () => cancelAnimationFrame(navigationFrame);
  }, [fontsLoaded, isOnboarded, pathname]);

  const toggleMenu = useCallback(() => {
    setIsMenuVisible((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuVisible(false);
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <RookWrapper>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <SafeAreaProvider>
            {null /* web-only leaflet styles removed — not needed in Expo Go */}
            <View style={styles.container}>
              <StatusBar style="auto" />

              <RootLayoutNav
                  toggleMenu={toggleMenu}
                  pathname={pathname}
                  cartItemCount={cartItemCount}
                  isOnboarded={isOnboarded} />
                

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

              <TypedHamburgerMenu isVisible={isMenuVisible} onClose={closeMenu} />
            </View>
          </SafeAreaProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </RookWrapper>);

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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#000' }}>Something went wrong</Text>
          <Text style={{ color: '#666', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
            {String(this.state.error)}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}