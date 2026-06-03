import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';

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
    if (router.canGoBack()) return (router.canGoBack() ? router.back() : router.replace('/'));
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
            <ChevronLeft size={24} color={tokens.colors.dark_navy.text_primary} />
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
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: 56,
  },
  solid: {
    backgroundColor: tokens.colors.dark_navy.bg_primary,
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
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...tokens.typography.heading_2_bold,
    color: tokens.colors.dark_navy.text_primary,
  },
  subtitle: {
    ...tokens.typography.xsmall_tight_regular,
    color: tokens.colors.dark_navy.text_secondary,
    marginTop: tokens.spacing.xs / 2,
  },
});
