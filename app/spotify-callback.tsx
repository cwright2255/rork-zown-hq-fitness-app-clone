import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { spotifyService } from '@/services/spotifyService';
import { useSpotifyStore } from '@/store/spotifyStore';
import Colors from '@/constants/colors';

export default function SpotifyCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const spotifyStore = useSpotifyStore() as unknown as { initializeSpotify: () => Promise<void> };
  const [status, setStatus] = useState('Processing Spotify authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify callback: Starting callback handling...');
        console.log('Spotify callback: Route params:', params);
        console.log('Spotify callback: Platform:', Platform.OS);
        
        const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
        console.log('Spotify callback: Current URL:', currentUrl);
        
        // Get code from multiple sources
        let code: string | null = null;
        let error: string | null = null;
        let state: string | null = null;
        
        // First try route params
        if (params.code) {
          code = params.code as string;
        }
        if (params.error) {
          error = params.error as string;
        }
        if (params.state) {
          state = params.state as string;
        }
        
        // Then try URL search params (web)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (!code) code = urlParams.get('code');
          if (!error) error = urlParams.get('error');
          if (!state) state = urlParams.get('state');
        }
        
        console.log('Spotify callback: Parsed params - code:', !!code, 'error:', error, 'state:', state);
        
        if (error) {
          console.error('Spotify authentication error:', error);
          const errorDescription = params.error_description as string || 'Unknown error';
          console.error('Error description:', errorDescription);
          setStatus(`Authentication error: ${error}`);
          setTimeout(() => router.replace('/profile/settings'), 2000);
          return;
        }
        
        if (code) {
          setStatus('Exchanging authorization code...');
          console.log('Spotify callback: Authorization code received, exchanging for token...');
          
          const callbackUrl = currentUrl || `https://rork.app/p/${process.env.EXPO_PUBLIC_PROJECT_ID}/spotify-callback?code=${code}&state=${state}`;
          const success = await spotifyService.handleAuthorizationCodeCallback(callbackUrl);
          
          if (success) {
            console.log('Spotify callback: Token exchange successful');
            setStatus('Connected successfully!');
            
            // Initialize Spotify store to update connection state
            await spotifyStore.initializeSpotify();
            
            // If this is a popup window, send message to parent and close
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
              try {
                window.opener.postMessage({
                  type: 'SPOTIFY_AUTH_CODE',
                  url: callbackUrl,
                  code: code,
                  state: state,
                }, '*');
                window.close();
                return;
              } catch {
                console.log('Failed to communicate with opener window');
              }
            }
          } else {
            console.error('Spotify callback: Token exchange failed');
            setStatus('Token exchange failed. Redirecting...');
          }
          
          setTimeout(() => router.replace('/profile/settings'), 1500);
          return;
        }
        
        // Check for implicit grant token in URL fragment
        const urlFragment = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';
        if (urlFragment && urlFragment.includes('access_token')) {
          setStatus('Processing access token...');
          console.log('Spotify callback: Processing implicit grant fragment');
          const success = await spotifyService.handleImplicitGrantCallback(urlFragment);
          
          if (success) {
            console.log('Spotify callback: Implicit grant authentication successful');
            setStatus('Connected successfully!');
            await spotifyStore.initializeSpotify();
          } else {
            console.error('Spotify callback: Implicit grant authentication failed');
            setStatus('Authentication failed.');
          }
          
          setTimeout(() => router.replace('/profile/settings'), 1500);
          return;
        }
        
        console.log('Spotify callback: No code or token found, redirecting');
        setStatus('No authentication data found. Redirecting...');
        setTimeout(() => router.replace('/profile/settings'), 1500);
      } catch (error) {
        console.error('Spotify callback: Error handling callback:', error);
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.replace('/profile/settings'), 2000);
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [router, params, spotifyStore]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
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
