import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { router, Stack } from 'expo-router';
import LoginScreen from '@/app/auth/login';
import { ErrorBoundary } from '@/components/LoadingScreen';

function StartScreenContent() {
  const screenH = useMemo(() => Dimensions.get('window').height, []);
  const [animating, setAnimating] = useState<boolean>(false);

  const coverY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const logoY = useRef<Animated.Value>(new Animated.Value(0)).current;
  const logoScale = useRef<Animated.Value>(new Animated.Value(1)).current;
  const logoOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;

  const runTransition = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    console.log('[StartScreen] Starting upshift reveal animation');

    const duration = 650;
    Animated.parallel([
      Animated.timing(coverY, {
        toValue: -screenH,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoY, {
        toValue: -Math.min(120, screenH * 0.18),
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 0.76,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 0.92,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      console.log('[StartScreen] Animation finished:', finished);
      if (finished) {
        try {
          router.replace('/auth/login');
        } catch (e) {
          console.error('[StartScreen] Navigation error', e);
          // Fallback navigation
          setTimeout(() => {
            try {
              router.push('/auth/login');
            } catch (fallbackError) {
              console.error('[StartScreen] Fallback navigation error', fallbackError);
            }
          }, 100);
        }
      }
    });
  }, [animating, coverY, logoOpacity, logoScale, logoY, screenH]);

  return (
    <ErrorBoundary>
      <View style={styles.root} testID="startup-root">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.layers}>
        <View style={styles.loginUnderlay} pointerEvents="none" accessibilityElementsHidden>
          <LoginScreen />
        </View>

        <Animated.View
          style={[styles.whiteCover, { transform: [{ translateY: coverY }] }]}
          testID="startup-cover"
        >
          <Pressable
            style={styles.pressArea}
            onPress={runTransition}
            disabled={animating}
            testID="startup-press"
          >
            <Animated.Image
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vweh81504p0fox25qu1wk' }}
              style={[
                styles.logo,
                {
                  opacity: logoOpacity,
                  transform: [{ translateY: logoY }, { scale: logoScale }],
                },
              ]}
              accessibilityRole="image"
              accessibilityLabel="ZOWN Logo"
              resizeMode="contain"
            />
          </Pressable>
        </Animated.View>
      </View>
      </View>
    </ErrorBoundary>
  );
}

export default function StartScreen() {
  return <StartScreenContent />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  layers: {
    flex: 1,
  },
  loginUnderlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  whiteCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 1,
  },
  pressArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 80,
  },
});
