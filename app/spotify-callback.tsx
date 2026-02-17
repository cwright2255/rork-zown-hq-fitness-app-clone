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
        console.log('Spotify callback: Starting callback handling...');
        console.log('Spotify callback: Route params:', params);
        console.log('Spotify callback: Platform:', Platform.OS);
        
        const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
        console.log('Spotify callback: Current URL:', currentUrl);
        
        let code: string | null = null;
        let error: string | null = null;
        let state: string | null = null;
        
        // Get params from route params first
        if (params.code) {
          code = params.code as string;
        }
        if (params.error) {
          error = params.error as string;
        }
        if (params.state) {
          state = params.state as string;
        }
        
        // On web, also try to get from URL params
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (!code) code = urlParams.get('code');
          if (!error) error = urlParams.get('error');
          if (!state) state = urlParams.get('state');
        }
        
        console.log('Spotify callback: Parsed params - code:', !!code, 'error:', error, 'state:', state);
        
        // Handle error from Spotify
        if (error) {
          console.error('Spotify authentication error:', error);
          const errorDescription = params.error_description as string || 'Unknown error';
          console.error('Error description:', errorDescription);
          setStatus(`Authentication error: ${error}`);
          
          // Try to communicate with opener window if this is a popup
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
            try {
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: error,
                errorDescription: errorDescription,
              }, '*');
              setTimeout(() => window.close(), 1000);
              return;
            } catch {
              console.log('Failed to communicate with opener window');
            }
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 2000);
          return;
        }
        
        // Handle authorization code
        if (code) {
          setStatus('Exchanging authorization code...');
          console.log('Spotify callback: Authorization code received, exchanging for token...');
          
          const callbackUrl = currentUrl || `https://rork.app/p/${process.env.EXPO_PUBLIC_PROJECT_ID || 'n6dgejrmm3wincmkq5smp'}/spotify-callback?code=${code}&state=${state}`;
          const success = await spotifyService.handleAuthorizationCodeCallback(callbackUrl);
          
          if (success) {
            console.log('Spotify callback: Token exchange successful');
            setStatus('Connected successfully!');
            
            await initializeSpotify();
            
            // Communicate success to opener window if this is a popup
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
              try {
                window.opener.postMessage({
                  type: 'SPOTIFY_AUTH_SUCCESS',
                  success: true,
                }, '*');
                setTimeout(() => window.close(), 500);
                return;
              } catch {
                console.log('Failed to communicate with opener window');
              }
            }
          } else {
            console.error('Spotify callback: Token exchange failed');
            setStatus('Token exchange failed. Redirecting...');
            
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
              try {
                window.opener.postMessage({
                  type: 'SPOTIFY_AUTH_ERROR',
                  error: 'token_exchange_failed',
                }, '*');
                setTimeout(() => window.close(), 1000);
                return;
              } catch {
                console.log('Failed to communicate with opener window');
              }
            }
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 1500);
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
            await initializeSpotify();
            
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
              try {
                window.opener.postMessage({
                  type: 'SPOTIFY_AUTH_SUCCESS',
                  success: true,
                }, '*');
                setTimeout(() => window.close(), 500);
                return;
              } catch {
                console.log('Failed to communicate with opener window');
              }
            }
          } else {
            console.error('Spotify callback: Implicit grant authentication failed');
            setStatus('Authentication failed.');
          }
          
          setTimeout(() => router.replace('/spotify-integration' as any), 1500);
          return;
        }
        
        console.log('Spotify callback: No code or token found, redirecting');
        setStatus('No authentication data found. Redirecting...');
        setTimeout(() => router.replace('/spotify-integration' as any), 1500);
      } catch (error) {
        console.error('Spotify callback: Error handling callback:', error);
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => router.replace('/spotify-integration' as any), 2000);
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [router, params, initializeSpotify]);

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
