// components/SplashScreen.jsx
//
// Plays the branded Lottie splash animation (assets/animations/splash-screen.json
// — the edited version: grayscale, current Zown logo, no leftover
// placeholder text/icon layers) on app cold start, replacing the previous
// plain ActivityIndicator-based LoadingScreen.
//
// This was built long before it was ever wired into the app's actual
// startup flow — the .lottie file existed as a standalone deliverable, but
// app/index.jsx rendered a generic spinner instead, and the asset itself
// was never copied into assets/animations/. Both are fixed here.
//
// Calls onFinish() once the animation completes. app/index.jsx waits for
// BOTH this and the (usually much faster) auth check before navigating,
// so a slow network doesn't cut the animation short, and a fast auth
// check doesn't skip past the animation entirely.

import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

export default function SplashScreen({ onFinish }) {
  const animationRef = useRef(null);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../assets/animations/splash-screen.json')}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={styles.animation}
        onAnimationFinish={() => onFinish?.()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  animation: { flex: 1, width: '100%', height: '100%' },
});
