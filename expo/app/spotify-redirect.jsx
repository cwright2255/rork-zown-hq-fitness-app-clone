import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';
import Colors from '@/constants/colors';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SpotifyRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { connectSpotifyImplicit, initializeSpotify } = useSpotifyStore();
  const [status, setStatus] = useState('Connecting to Spotify...');
  const fallbackRoute = useMemo(() => '/spotify-integration', []);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify redirect: Starting callback handling...');

        const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
        const isPopup = isWeb && !!window.opener;
        const currentUrl = isWeb ? window.location.href : '';
        const urlSearch = isWeb ? window.location.search : '';
        const urlHash = isWeb ? window.location.hash : '';

        console.log('Spotify redirect: Current URL:', currentUrl);
        console.log('Spotify redirect: URL hash:', urlHash);
        console.log('Spotify redirect: URL search:', urlSearch);
        console.log('Spotify redirect: Is popup:', isPopup);

        const postPopupMessage = (message) => {
          if (!isWeb || !isPopup) return;
          try {
            window.opener.postMessage(message, '*');
            setTimeout(() => window.close(), 400);
          } catch (postError) {
            console.error('Spotify redirect: Failed to post popup message:', postError);
          }
        };

        let code = typeof params.code === 'string' ? params.code : null;
        let error = typeof params.error === 'string' ? params.error : null;

        if (isWeb) {
          const searchParams = new URLSearchParams(urlSearch);
          if (!code) code = searchParams.get('code');
          if (!error) error = searchParams.get('error');
        }

        if (error) {
          console.error('Spotify redirect: Auth error:', error);
          setStatus(`Authentication error: ${error}`);
          postPopupMessage({ type: 'SPOTIFY_AUTH_ERROR', error });
          setTimeout(() => router.replace(fallbackRoute), 900);
          return;
        }

        if (code) {
          setStatus('Finalizing login...');
          const success = await spotifyService.handleAuthorizationCodeCallback(currentUrl || `?code=${code}`);
          if (success) {
            await initializeSpotify();
            setStatus('Spotify connected!');
            postPopupMessage({ type: 'SPOTIFY_AUTH_SUCCESS', success: true });
          } else {
            setStatus('Could not complete Spotify login.');
            postPopupMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'token_exchange_failed' });
          }
          setTimeout(() => router.replace(fallbackRoute), 900);
          return;
        }

        if (urlHash && urlHash.includes('access_token')) {
          setStatus('Finalizing login...');
          const success = await connectSpotifyImplicit(urlHash);
          if (success) {
            setStatus('Spotify connected!');
            postPopupMessage({ type: 'SPOTIFY_AUTH_SUCCESS', success: true });
          } else {
            setStatus('Could not complete Spotify login.');
            postPopupMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'implicit_grant_failed' });
          }
          setTimeout(() => router.replace(fallbackRoute), 900);
          return;
        }

        console.log('Spotify redirect: No auth payload found');
        setStatus('No authentication data found.');
        postPopupMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'no_auth_data' });
        setTimeout(() => router.replace('/spotify-integration'), 900);
      } catch (error) {
        console.error('Spotify redirect: Error handling callback:', error);
        setStatus('Authentication failed.');
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
          try {
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'callback_exception' }, '*');
            setTimeout(() => window.close(), 400);
            return;
          } catch (postError) {
            console.error('Spotify redirect: Failed to post exception to popup opener:', postError);
          }
        }
        setTimeout(() => router.replace(fallbackRoute), 1200);
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [connectSpotifyImplicit, fallbackRoute, initializeSpotify, params.code, params.error, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.subText}>Please wait while we complete the authentication process.</Text>
    </View>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center'
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center'
  }
});