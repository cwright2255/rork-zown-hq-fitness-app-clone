import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, Utensils, ShoppingBag, User } from 'lucide-react-native';
import { tokens } from '../../theme/tokens';

const tabs = [
  { name: 'HQ', icon: Home, route: '/hq' },
  { name: 'Workouts', icon: Dumbbell, route: '/workouts' },
  { name: 'Nutrition', icon: Utensils, route: '/nutrition' },
  { name: 'Shop', icon: ShoppingBag, route: '/shop' },
  { name: 'Profile', icon: User, route: '/profile' },
];

const TabItem = React.memo(function TabItem({ tab, isActive, onPress }) {
  const Icon = tab.icon;

  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${tab.name}`}>
      <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
        <Icon
          size={22}
          color={isActive ? tokens.colors.brand.base : tokens.colors.dark_navy.text_muted}
        />
      </View>
      <Text style={[styles.label, isActive && styles.activeLabel]}>
        {tab.name}
      </Text>
    </TouchableOpacity>
  );
});

const BottomNavigation = React.memo(function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = useCallback((route) => {
    router.push(route);
  }, [router]);

  const activeRoute = useMemo(() => {
    if (pathname === '/hq' || pathname === '/') return '/hq';
    for (const tab of tabs) {
      if (pathname === tab.route || pathname.startsWith(tab.route + '/')) {
        return tab.route;
      }
    }
    return '/hq';
  }, [pathname]);

  const tabsWithActiveState = useMemo(() =>
    tabs.map((tab) => ({
      ...tab,
      isActive: tab.route === activeRoute
    })),
    [activeRoute]
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {tabsWithActiveState.map((tab) =>
          <TabItem
            key={tab.name}
            tab={tab}
            isActive={tab.isActive}
            onPress={() => handleNavigation(tab.route)}
          />
        )}
      </View>
    </View>
  );
});

export default BottomNavigation;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.sm,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.xl,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    ...tokens.shadows.shadow_medium,
    borderWidth: 1,
    borderColor: tokens.colors.dark_navy.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  iconContainer: {
    width: 40,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
    borderRadius: tokens.radius.lg,
  },
  activeIconContainer: {
    backgroundColor: tokens.colors.brand.base + '22',
    borderRadius: tokens.radius.lg,
  },
  label: {
    ...tokens.typography.xsmall_tight_medium,
    color: tokens.colors.dark_navy.text_muted,
  },
  activeLabel: {
    ...tokens.typography.xsmall_tight_bold,
    color: tokens.colors.brand.base,
  },
});
