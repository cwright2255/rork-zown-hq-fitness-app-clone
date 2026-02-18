import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { spotifyService } from '@/services/spotifyService';
import { useSpotifyStore } from '@/store/spotifyStore';
import Colors from '@/constants/colors';

export default function SpotifyCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { initializeSpotify } = useSpotifyStore();
  const [status, setStatus] = useState('Processing Spotify authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('SpotifyCallback: Starting...');
        console.log('SpotifyCallback: Route params:', JSON.stringify(params));
        
        const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
        console.log('SpotifyCallback: Current URL:', currentUrl);
        const isPopup = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.opener;
        console.log('SpotifyCallback: Is popup:', isPopup);
        
        let code: string | null = null;
        let error: string | null = null;
        let state: string | null = null;
        
        if (params.code) code = params.code as string;
        if (params.error) error = params.error as string;
        if (params.state) state = params.state as string;
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (!code) code = urlParams.get('code');
          if (!error) error = urlParams.get('error');
          if (!state) state = urlParams.get('state');
        }
        
        console.log('SpotifyCallback: code:', !!code, 'error:', error, 'state:', state);

        if (error) {
          console.error('SpotifyCallback: Auth error:', error);
          setStatus(`Authentication error: ${error}`);
          
          if (isPopup) {
            try {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error }, '*');
              setTimeout(() => window.close(), 1000);
              return;
            } catch { /* ignore */ }
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 2000);
          return;
        }

        if (code) {
          setStatus('Exchanging authorization code...');
          console.log('SpotifyCallback: Exchanging code for token...');
          
          const callbackUrl = currentUrl || `https://rork.app/p/${process.env.EXPO_PUBLIC_PROJECT_ID || 'n6dgejrmm3wincmkq5smp'}/spotify-callback?code=${code}&state=${state}`;
          const success = await spotifyService.handleAuthorizationCodeCallback(callbackUrl);
          
          if (success) {
            console.log('SpotifyCallback: Token exchange successful!');
            setStatus('Connected successfully!');
            await initializeSpotify();
            
            if (isPopup) {
              try {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', success: true }, '*');
                setTimeout(() => window.close(), 500);
                return;
              } catch { /* ignore */ }
            }
          } else {
            console.error('SpotifyCallback: Token exchange failed');
            setStatus('Token exchange failed. Redirecting...');
            
            if (isPopup) {
              try {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'token_exchange_failed' }, '*');
                setTimeout(() => window.close(), 1000);
                return;
              } catch { /* ignore */ }
            }
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 1500);
          return;
        }

        const urlFragment = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';
        if (urlFragment && urlFragment.includes('access_token')) {
          setStatus('Processing access token...');
          const success = await spotifyService.handleImplicitGrantCallback(urlFragment);
          
          if (success) {
            setStatus('Connected successfully!');
            await initializeSpotify();
            
            if (isPopup) {
              try {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', success: true }, '*');
                setTimeout(() => window.close(), 500);
                return;
              } catch { /* ignore */ }
            }
          } else {
            setStatus('Authentication failed.');
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 1500);
          return;
        }
        
        console.log('SpotifyCallback: No auth data found');
        setStatus('No authentication data found. Redirecting...');
        
        if (isPopup) {
          try {
            window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'no_auth_data' }, '*');
            setTimeout(() => window.close(), 1000);
            return;
          } catch { /* ignore */ }
        }
        
        setTimeout(() => router.replace('/spotify-integration' as any), 1500);
      } catch (error) {
        console.error('SpotifyCallback: Error:', error);
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.replace('/spotify-integration' as any), 2000);
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [router, params, initializeSpotify]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1DB954" />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.subtext}>Please wait...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
