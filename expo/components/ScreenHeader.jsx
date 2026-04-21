import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

export default function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
  style,
}) {
  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) return router.back();
    router.replace('/hq');
  };

  return (
    <View
      style={[
        styles.container,
        transparent ? styles.transparent : styles.solid,
        style,
      ]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={8}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.center}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
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
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  solid: {
    backgroundColor: colors.bg,
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
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
});
