import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

// Real safe-area top inset via useSafeAreaInsets, not a fixed guess and
// not left to whatever the parent screen happens to wrap this in -
// previously this component had zero safe-area awareness of its own,
// so any screen that rendered it inside a plain View (not a
// SafeAreaView) got a header sitting under the status bar/notch. This
// makes the header safe regardless of how the parent screen wraps it.
//
// Also: solid and transparent modes need different contrast.
// Transparent is used over a camera preview (see
// app/nutrition/barcode-scan.jsx) and needs light icons/text to stay
// legible against varied real camera imagery; solid is used on a white
// background and needs dark icons/text. The previous version used one
// fixed color for both, which is correct for at most one of the two.
export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
  style,
}) {
  const insets = useSafeAreaInsets();
  const fg = transparent ? '#FFFFFF' : '#000000';
  const subFg = transparent ? 'rgba(255,255,255,0.75)' : '#666666';

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) return (router.canGoBack() ? router.back() : router.replace('/'));
    router.replace('/hq');
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        transparent ? styles.transparent : styles.solid,
        style,
      ]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={8}>
            <ChevronLeft size={24} color={fg} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.center}>
        {title ? <Text style={[styles.title, { color: fg }]} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: subFg }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {rightAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 56,
  },
  solid: {
    backgroundColor: '#FFFFFF',
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
