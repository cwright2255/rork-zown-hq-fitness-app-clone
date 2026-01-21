import React, { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useUserStore } from '@/store/userStore';
import LoadingScreen, { ErrorBoundary } from '@/components/LoadingScreen';
import { authService } from '@/services/authService';
import { spotifyService } from '@/services/spotifyService';

function IndexContent() {
  const { isOnboarded } = useUserStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [handlingSpotify, setHandlingSpotify] = useState(false);
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

  if (isInitializing || handlingSpotify) {
    return <LoadingScreen message={handlingSpotify ? "Connecting Spotify..." : "Initializing..."} />;
  }

  if (!isAuthed) {
    return <Redirect href="/start" />;
  }

  return <Redirect href={isOnboarded ? '/hq' : '/start'} />;
}

export default function Index() {
  return (
    <ErrorBoundary>
      <IndexContent />
    </ErrorBoundary>
  );
}