import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { spotifyService } from '@/services/spotifyService';
import Colors from '@/constants/colors';

export default function SpotifyCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify callback: Starting callback handling...');
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        console.log('Spotify callback: Current URL:', currentUrl);
        
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const error = urlParams.get('error');
        const code = urlParams.get('code');
        
        if (error) {
          console.error('Spotify authentication error:', error);
          const errorDescription = urlParams.get('error_description') || 'Unknown error';
          console.error('Error description:', errorDescription);
          router.replace('/profile/settings');
          return;
        }
        
        if (code) {
          console.log('Spotify callback: Authorization code received, exchanging for token...');
          const success = await spotifyService.handleAuthorizationCodeCallback(currentUrl);
          
          if (success) {
            console.log('Spotify callback: Token exchange successful');
            
            if (typeof window !== 'undefined' && window.opener) {
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_CODE',
                url: currentUrl,
                code: code,
                state: urlParams.get('state'),
              }, '*');
              window.close();
              return;
            }
          } else {
            console.error('Spotify callback: Token exchange failed');
          }
          
          router.replace('/profile/settings');
          return;
        }
        
        const urlFragment = typeof window !== 'undefined' ? window.location.hash : '';
        if (urlFragment && urlFragment.includes('access_token')) {
          console.log('Spotify callback: Processing implicit grant fragment');
          const success = await spotifyService.handleImplicitGrantCallback(urlFragment);
          
          if (success) {
            console.log('Spotify callback: Implicit grant authentication successful');
          } else {
            console.error('Spotify callback: Implicit grant authentication failed');
          }
        } else {
          console.log('Spotify callback: No code or token found, redirecting');
        }
        
        router.replace('/profile/settings');
      } catch (error) {
        console.error('Spotify callback: Error handling callback:', error);
        router.replace('/');
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Connecting to Spotify...</Text>
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
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
