import React, { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useUserStore } from '@/store/userStore';
import LoadingScreen from '@/components/LoadingScreen';
import SplashScreen from '@/components/SplashScreen';
import { authService } from '@/services/authService';
import { spotifyService } from '@/services/spotifyService';



function IndexContent() {
  const { isOnboarded } = useUserStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [handlingSpotify, setHandlingSpotify] = useState(false);
  // Splash and the auth check run in parallel - navigation waits for
  // whichever finishes last, so a slow network doesn't cut the animation
  // short and a fast auth check doesn't skip past it entirely.
  const [splashDone, setSplashDone] = useState(false);
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const handleSpotifyCallback = async () => {
      const code = params.code || (Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null);
      const state = params.state || (Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('state') : null);

      if (code) {
        console.log('[Index] Spotify callback detected, processing...');
        setHandlingSpotify(true);
        try {
          const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : `?code=${code}&state=${state}`;
          const success = await spotifyService.handleAuthorizationCodeCallback(currentUrl);
          console.log('[Index] Spotify auth result:', success);

          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          if (mounted) {
            router.replace('/profile/settings');
          }
          return true;
        } catch (error) {
          console.error('[Index] Spotify callback error:', error);
        } finally {
          if (mounted) setHandlingSpotify(false);
        }
      }
      return false;
    };

    (async () => {
      try {
        const wasSpotifyCallback = await handleSpotifyCallback();
        if (wasSpotifyCallback) return;

        console.log('[Index] Checking authentication status');
        // Now expiry-aware - see services/authService.js's isAuthenticated():
        // a "remembered" login can be configured (Settings     Account) to
        // expire after 1 month, 3 months, or never, and this returns false
        // (clearing the stale token) if the configured window has passed.
        const authed = await authService.isAuthenticated();
        console.log('[Index] Authentication status:', authed);
        if (mounted) setIsAuthed(authed);
      } catch (e) {
        console.log('[Index] Auth check error:', e);
        if (mounted) setIsAuthed(false);
      } finally {
        if (mounted) {
          console.log('[Index] Initialization complete');
          setIsInitializing(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params.code, params.state, router]);

  if (handlingSpotify) {
    return <LoadingScreen message="Connecting Spotify..." />;
  }

  if (isInitializing || !splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  if (!isAuthed) {
    return <Redirect href="/start" />;
  }

  return <Redirect href={isOnboarded ? '/hq' : '/start'} />;
}

export default function Index() {
  return (
    
      <IndexContent />
    );

}