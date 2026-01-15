import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';
import Colors from '@/constants/colors';

export default function SpotifyCallbackWithId() {
  const router = useRouter();
  const connectSpotifyImplicit = useSpotifyStore((state: any) => state.connectSpotifyImplicit);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify callback [id]: Starting callback handling...');
        console.log('Spotify callback [id]: Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
        console.log('Spotify callback [id]: URL hash:', typeof window !== 'undefined' ? window.location.hash : 'N/A');
        console.log('Spotify callback [id]: URL search:', typeof window !== 'undefined' ? window.location.search : 'N/A');
        
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const error = urlParams.get('error');
        
        if (error) {
          console.error('Spotify authentication error:', error);
          const errorDescription = urlParams.get('error_description') || 'Unknown error';
          console.error('Error description:', errorDescription);
          router.replace('/profile/settings');
          return;
        }
        
        let urlFragment = typeof window !== 'undefined' ? window.location.hash : '';
        
        if (!urlFragment && typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const accessToken = searchParams.get('access_token');
          if (accessToken) {
            urlFragment = '#' + window.location.search.substring(1);
            console.log('Spotify callback [id]: Converted search params to fragment:', urlFragment);
          }
        }
        
        if (urlFragment) {
          console.log('Spotify callback [id]: Processing URL fragment:', urlFragment);
          const success = await connectSpotifyImplicit(urlFragment);
          
          if (success) {
            console.log('Spotify callback [id]: Authentication successful');
            router.replace('/profile/settings');
          } else {
            console.error('Spotify callback [id]: Authentication failed');
            router.replace('/profile/settings');
          }
        } else {
          console.log('Spotify callback [id]: No URL fragment found, redirecting');
          router.replace('/profile/settings');
        }
      } catch (error) {
        console.error('Spotify callback [id]: Error handling callback:', error);
        router.replace('/');
      }
    };

    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [connectSpotifyImplicit, router]);

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
