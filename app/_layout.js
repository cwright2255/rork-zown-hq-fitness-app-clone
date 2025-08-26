import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Menu, ShoppingCart, Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useShopStore } from '@/store/shopStore';
import HamburgerMenu from '@/components/HamburgerMenu';
import { ErrorBoundary } from '@/components/LoadingScreen';
import * as Linking from 'expo-linking';
import { processAdminLink } from '@/services/remoteAdminService';
import { useSpotifyStore } from '@/store/spotifyStore';
import Head from 'expo-router/head';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '@/lib/trpc';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();



const RootLayoutNav = React.memo(({ toggleMenu, pathname, cartItemCount, isOnboarded }) => {
  // Use useMemo to avoid recalculating this on every render
  const isShopPage = useMemo(() => 
    pathname === '/shop' || pathname.startsWith('/shop/'),
    [pathname]
  );
  
  const shouldShowNav = useMemo(() => 
    isOnboarded && 
    pathname !== '/onboarding' && 
    !pathname.startsWith('/auth/') &&
    pathname !== '/index' &&
    pathname !== '/start' &&
    pathname !== '/workout/active',
    [isOnboarded, pathname]
  );

  // Memoize callbacks to prevent re-renders - must be before conditional return
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
      >
        <Menu size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.navActions}>
        <TouchableOpacity 
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Bell size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        
        {isShopPage && (
          <TouchableOpacity 
            style={styles.cartButton}
            accessibilityRole="button"
            accessibilityLabel={`Shopping cart with ${cartItemCount} items`}
          >
            <ShoppingCart size={24} color={Colors.text.primary} />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartItemCount > 99 ? '99+' : cartItemCount.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

RootLayoutNav.displayName = 'RootLayoutNav';

// Create a single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const pathname = usePathname();
  const { isOnboarded } = useUserStore();
  const { cart } = useShopStore();
  const { connectSpotify, connectSpotifyImplicit } = useSpotifyStore();
  
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  // Calculate cart item count
  const cartItemCount = useMemo(() => 
    cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle deep linking for Spotify callback - memoized handler
  const handleDeepLink = useCallback(async (event) => {
    const url = event.url;
    setTimeout(async () => {
      if (url) {
        try {
          const parsed = Linking.parse(url);
          const authCode = parsed.queryParams?.code;
          const fragment = url.includes('#') ? url.substring(url.indexOf('#')) : undefined;
          if (fragment && fragment.includes('access_token')) {
            await connectSpotifyImplicit(fragment);
          } else if (authCode) {
            await connectSpotify(authCode);
          }
        } catch (error) {
          console.error('Error handling Spotify deep link:', error);
        }
        try {
          const res = await processAdminLink(url);
          if (res.handled) {
            console.log('[AdminLink] Command handled:', res.message);
          }
        } catch (e) {
          console.log('[AdminLink] No admin command in link');
        }
      }
    }, 0);
  }, [connectSpotify, connectSpotifyImplicit]);

  useEffect(() => {
    // Use Linking.addEventListener with the correct signature for Expo SDK 52
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if the app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        // Create a proper event object
        handleDeepLink({ url });
      }
    }).catch(console.error);

    return () => {
      // Use the correct method to remove the listener
      subscription.remove();
    };
  }, [handleDeepLink]);

  // Handle navigation logic with proper timing - only for authenticated users
  useEffect(() => {
    if (!fontsLoaded) return;

    // Don't interfere with authentication flow - let index.tsx handle initial routing
    if (pathname === '/' || pathname === '/index' || pathname === '/start' || pathname.startsWith('/auth/')) {
      return;
    }

    // Use requestAnimationFrame for better performance
    const navigationFrame = requestAnimationFrame(() => {
      // Only handle onboarding navigation for authenticated users who are already past auth flow
      if (!isOnboarded && pathname !== '/start' && !pathname.startsWith('/auth/') && pathname !== '/') {
        // Only navigate if we're not already on the target route
        if (pathname !== '/onboarding') {
          import('expo-router').then(({ router }) => {
            router.replace('/start');
          }).catch(console.error);
        }
      } else if (isOnboarded && pathname === '/start') {
        // Navigate to HQ if onboarded but still on onboarding page
        import('expo-router').then(({ router }) => {
          router.replace('/hq');
        }).catch(console.error);
      }
    });

    return () => cancelAnimationFrame(navigationFrame);
  }, [fontsLoaded, isOnboarded, pathname]);

  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <SafeAreaProvider>
      {Platform.OS === 'web' && (
        <Head>
          <link 
            rel="stylesheet" 
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
        </Head>
      )}
      <View style={styles.container}>
        <StatusBar style="auto" />
        
        <RootLayoutNav 
          toggleMenu={toggleMenu}
          pathname={pathname}
          cartItemCount={cartItemCount}
          isOnboarded={isOnboarded}
        />
        
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
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
        </Stack>
        
        <HamburgerMenu 
          isVisible={isMenuVisible} 
          onClose={closeMenu} 
        />
          </View>
          </SafeAreaProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    zIndex: 1000,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
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
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});