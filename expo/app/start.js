import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { router, Stack } from 'expo-router';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SplashScreen() {
  useEffect(() => {
    router.replace('/auth/login');
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
