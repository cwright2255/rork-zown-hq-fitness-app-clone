import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';
import Colors from '@/constants/colors';

export default function SpotifyRedirect() {
  const router = useRouter();
  const { connectSpotifyImplicit } = useSpotifyStore() as {
    connectSpotifyImplicit: (urlFragment: string) => Promise<boolean>;
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify redirect: Starting callback handling...');
        
        // Check if we're on web and have access to window
        if (typeof window !== 'undefined') {
          console.log('Spotify redirect: Current URL:', window.location.href);
          console.log('Spotify redirect: URL hash:', window.location.hash);
          console.log('Spotify redirect: URL search:', window.location.search);
          
          // Get the URL fragment (everything after #) for implicit grant flow
          let urlFragment = window.location.hash;
          
          // If no fragment but we have search params, check if token is in search params
          if (!urlFragment && window.location.search) {
            const searchParams = new URLSearchParams(window.location.search);
            const accessToken = searchParams.get('access_token');
            if (accessToken) {
              // Convert search params to fragment format
              urlFragment = '#' + window.location.search.substring(1);
              console.log('Spotify redirect: Converted search params to fragment:', urlFragment);
            }
          }
          
          if (urlFragment) {
            console.log('Spotify redirect: Processing URL fragment:', urlFragment);
            
            const success = await connectSpotifyImplicit(urlFragment);
            
            if (success) {
              console.log('Spotify redirect: Authentication successful');
              // Redirect to settings page
              window.location.href = '/profile/settings';
            } else {
              console.error('Spotify redirect: Authentication failed');
              window.location.href = '/profile/settings';
            }
          } else {
            console.log('Spotify redirect: No URL fragment found');
            window.location.href = '/profile/settings';
          }
        } else {
          // On mobile, redirect to settings
          router.replace('/profile/settings');
        }
      } catch (error) {
        console.error('Spotify redirect: Error handling callback:', error);
        if (typeof window !== 'undefined') {
          window.location.href = '/profile/settings';
        } else {
          router.replace('/profile/settings');
        }
      }
    };

    // Small delay to ensure the component is mounted
    const timer = setTimeout(handleCallback, 100);
    
    return () => clearTimeout(timer);
  }, [connectSpotifyImplicit, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Connecting to Spotify...</Text>
      <Text style={styles.subText}>Please wait while we complete the authentication process.</Text>
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
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});