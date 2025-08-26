import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSpotifyStore } from '@/store/spotifyStore';
import Colors from '@/constants/colors';

export default function SpotifyCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { connectSpotifyImplicit } = useSpotifyStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Spotify callback: Starting callback handling...');
        console.log('Spotify callback: Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
        console.log('Spotify callback: URL hash:', typeof window !== 'undefined' ? window.location.hash : 'N/A');
        console.log('Spotify callback: URL search:', typeof window !== 'undefined' ? window.location.search : 'N/A');
        
        // Check for error in URL params first
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const error = urlParams.get('error') || params.error as string;
        
        if (error) {
          console.error('Spotify authentication error:', error);
          const errorDescription = urlParams.get('error_description') || 'Unknown error';
          console.error('Error description:', errorDescription);
          router.replace('/profile/settings');
          return;
        }
        
        // Get the URL fragment (everything after #) for implicit grant flow
        let urlFragment = typeof window !== 'undefined' ? window.location.hash : '';
        
        // If no fragment but we have search params, check if token is in search params
        if (!urlFragment && typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const accessToken = searchParams.get('access_token');
          if (accessToken) {
            // Convert search params to fragment format
            urlFragment = '#' + window.location.search.substring(1);
            console.log('Spotify callback: Converted search params to fragment:', urlFragment);
          }
        }
        
        if (urlFragment) {
          console.log('Spotify callback: Processing URL fragment:', urlFragment);
          
          // For direct navigation, handle the callback
          console.log('Spotify callback: Processing callback...');
          const success = await connectSpotifyImplicit(urlFragment);
          
          if (success) {
            console.log('Spotify callback: Authentication successful, redirecting to home');
            router.replace('/profile/settings');
          } else {
            console.error('Spotify callback: Authentication failed');
            router.replace('/profile/settings');
          }
        } else {
          console.log('Spotify callback: No URL fragment or access token found, redirecting to home');
          router.replace('/profile/settings');
        }
      } catch (error) {
        console.error('Spotify callback: Error handling callback:', error);
        router.replace('/');
      }
    };

    // Small delay to ensure the component is mounted
    const timer = setTimeout(handleCallback, 100);
    
    return () => clearTimeout(timer);
  }, [params, connectSpotifyImplicit, router]);

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