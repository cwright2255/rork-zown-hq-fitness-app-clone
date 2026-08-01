import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View, Animated, Image } from 'react-native';
import { tokens } from '../../theme/tokens';

// CRITICAL: ErrorBoundary is exported FIRST before any other imports that could
// throw at module-load time. expo-router reads `routeModule.ErrorBoundary` when
// loading this route, and if any later top-level import rejects (e.g.
// Firebase initialization, auth checks, etc), the app crashes with a
// red chase screen instead of catching it prettily.
export { ErrorBoundary } from '../src/components/ErrorBoundary';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initMocks } from '../src/services/mockService';
import { LoggingService } from '../src/services/loggingService';
import { getRookSdkCredentials } from '../src/services/firebase';

// Initialize mocks & logging
initMocks();
function log(...args) {
  LoggingService.log('[Layout]', ...args);
}

// Inline fallback gate so the app renders even if ROOK sync fails or is missing.
function RookSyncGate({ children }) {
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getRookSdkCredentials()
      .then((res) => {
        if (!active) return;
        if (res && res.clientUUID && res.secretKey) {
          log('Fetched ROOK credentials from Firebase function');
          setCredentials(res);
        } else {
          log('No valid ROOK credentials returned from Firebase function');
        }
      })
      .catch((err) => {
        log('Failed to fetch ROOK credentials: ', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing security & sync...</Text>
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RookSyncGate>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.background } }}} />
      </RookSyncGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: tokens.colors.textMuted,
    fontSize: 14,
  },
});
