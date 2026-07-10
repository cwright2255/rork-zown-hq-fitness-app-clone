import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function AnimatedPressable({ children, onPress, style, ...props }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { 
      toValue: 0.97, 
      tension: 100,
      friction: 10,
      useNativeDriver: true 
    }).start();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Graceful fallback if haptics fail or on web
    }
  };

  const onPressOut = () => {
    Animated.spring(scaleAnim, { 
      toValue: 1, 
      tension: 100,
      friction: 10,
      useNativeDriver: true 
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      {...props}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
