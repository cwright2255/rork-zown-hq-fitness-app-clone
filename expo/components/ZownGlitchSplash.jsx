// components/ZownGlitchSplash.jsx
//
// The launch splash: the black ZOWN wordmark glitches in on white (what it looks like at each frame is lib/zownGlitchSpec.js),
// holds clean, then the white slides up to reveal the screen underneath, which is the login screen
// (app/auth/login.jsx puts this on top of itself). onFinish() is called when the slide is done.
//
// It covers the whole screen and takes the touches while it is up, so nothing underneath can be tapped by accident. It plays
// for GLITCH_MS + SLIDE_MS (4 seconds), and a safety timer ends it even if the animation is somehow held up.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { frameSpec, SPEC } from '@/lib/zownGlitchSpec';

const WORDMARK = require('@/assets/branding/zown-wordmark.png');

export const LOGO_WIDTH_RATIO = 0.7; // the wordmark is 70% of the screen's width
export const GLITCH_MS = Math.round((SPEC.TOTAL_FRAMES * 1000) / SPEC.FPS);
export const SLIDE_MS = 800; // the same slide the login screen has always had
export const FAILSAFE_MS = GLITCH_MS + SLIDE_MS + 1500;

// A horizontal slice of the wordmark, pushed sideways, in one colour (no tint = the logo's own black).
function Slices({ bands, k, logoW, logoH, tint, side }) {
  return bands.map((b, i) => {
    if (!b.visible) return null;
    const top = Math.round(b.sy * k);
    const height = Math.round((b.sy + b.sh) * k) - top; // rounded at the edges, so neighbouring slices meet with no hairline
    if (height <= 0) return null;
    return (
      <View
        key={i}
        style={{ position: 'absolute', left: 0, top, width: logoW, height, overflow: 'hidden', transform: [{ translateX: (b.dx + side * b.split) * k }] }}>
        <Image
          source={WORDMARK}
          resizeMode="stretch"
          style={[{ position: 'absolute', left: 0, top: -top, width: logoW, height: logoH }, tint ? { tintColor: tint } : null]}
        />
      </View>
    );
  });
}

export default function ZownGlitchSplash({ onFinish }) {
  const { width, height } = useWindowDimensions();
  const [frame, setFrame] = useState(0);
  const slideY = useRef(new Animated.Value(0)).current;
  const heightRef = useRef(height);
  heightRef.current = height;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let raf = 0;
    let done = false;
    let slide = null;
    const start = Date.now();
    const finish = () => {
      if (done) return;
      done = true;
      if (onFinishRef.current) onFinishRef.current();
    };
    const failsafe = setTimeout(finish, FAILSAFE_MS);
    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed >= GLITCH_MS) {
        setFrame(SPEC.TOTAL_FRAMES - 1);
        slide = Animated.timing(slideY, { toValue: -heightRef.current, duration: SLIDE_MS, useNativeDriver: true });
        slide.start(finish);
        return;
      }
      setFrame(Math.floor((elapsed * SPEC.FPS) / 1000)); // by the clock, so a slow phone drops frames instead of running long
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      done = true; // leaving early (the screen was closed) must not call onFinish
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
      if (slide) slide.stop();
    };
  }, [slideY]);

  const spec = useMemo(() => frameSpec(frame), [frame]);
  const logoW = Math.round(width * LOGO_WIDTH_RATIO);
  const k = logoW / SPEC.LOGO_W;
  const logoH = Math.round(SPEC.LOGO_H * k);
  const left = Math.round((width - logoW) / 2);
  const top = Math.round((height - logoH) / 2 + spec.dy * k);

  return (
    <Animated.View testID="launch-splash" style={[styles.overlay, { transform: [{ translateY: slideY }] }]}>
      <View
        testID="launch-splash-logo"
        accessible
        accessibilityLabel="ZOWN"
        style={{ position: 'absolute', left, top, width: logoW, height: logoH, transform: [{ scale: spec.scale }] }}>
        {spec.clean ? (
          <Image source={WORDMARK} resizeMode="stretch" style={{ width: logoW, height: logoH }} />
        ) : (
          <>
            {spec.echo ? (
              <Image
                source={WORDMARK}
                resizeMode="stretch"
                style={{ position: 'absolute', left: 0, top: Math.round(spec.echo.dy * k), width: logoW, height: logoH, tintColor: spec.echo.color }}
              />
            ) : null}
            {spec.fringe ? <Slices bands={spec.bands} k={k} logoW={logoW} logoH={logoH} tint={SPEC.CYAN} side={-1} /> : null}
            {spec.fringe ? <Slices bands={spec.bands} k={k} logoW={logoW} logoH={logoH} tint={SPEC.ORANGE} side={1} /> : null}
            <Slices bands={spec.bands} k={k} logoW={logoW} logoH={logoH} tint={null} side={0} />
            {spec.blocks.map((b, i) => (
              <View
                key={`block${i}`}
                style={{
                  position: 'absolute',
                  left: Math.round(b.x * k),
                  top: Math.round(b.y * k),
                  width: Math.max(1, Math.round(b.w * k)),
                  height: Math.max(1, Math.round(b.h * k)),
                  backgroundColor: b.color,
                }}
              />
            ))}
            {spec.lines.map((l, i) => (
              <View
                key={`line${i}`}
                style={{
                  position: 'absolute',
                  left: Math.round(l.x * k),
                  top: Math.round(l.y * k),
                  width: Math.max(1, Math.round(l.w * k)),
                  height: Math.max(1, Math.round(l.h * k)),
                  backgroundColor: l.color,
                }}
              />
            ))}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
});
