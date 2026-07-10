import * as Haptics from 'expo-haptics';
import React, { useMemo, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/* ââ Tab configurations ââ */

const HOME_TABS = [
  { key: 'workouts', label: 'Workouts', icon: 'barbell-outline', activeIcon: 'barbell', route: '/workouts' },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', activeIcon: 'nutrition', route: '/nutrition/log' },
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/hq' },
  { key: 'shop', label: 'Shop', icon: 'cart-outline', activeIcon: 'cart', route: '/shop' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person', route: '/profile' },
];

const WORKOUT_TABS = [
  { key: 'workouts', label: 'Workouts', icon: 'barbell-outline', activeIcon: 'barbell', route: '/workouts' },
  { key: 'running', label: 'Running', icon: 'fitness-outline', activeIcon: 'fitness', route: '/running/program' },
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/hq' },
  { key: 'challenges', label: 'Challenges', icon: 'trophy-outline', activeIcon: 'trophy', route: '/badges' },
  { key: 'analysis', label: 'Analysis', icon: 'analytics-outline', activeIcon: 'analytics', route: '/analytics' },
];

const HEALTH_TABS = [
  { key: 'health', label: 'Health', icon: 'heart-outline', activeIcon: 'heart', route: '/health' },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', activeIcon: 'nutrition', route: '/nutrition/log' },
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/hq' },
  { key: 'recipes', label: 'Recipes', icon: 'restaurant-outline', activeIcon: 'restaurant', route: '/recipes' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', activeIcon: 'calendar', route: '/calendar' },
];

const PROFILE_TABS = [
  { key: 'social', label: 'Social', icon: 'people-outline', activeIcon: 'people', route: '/social' },
  { key: 'battlepass', label: 'Battle Pass', icon: 'rocket-outline', activeIcon: 'rocket', route: '/battlepass' },
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/hq' },
  { key: 'progress', label: 'Progress', icon: 'trending-up-outline', activeIcon: 'trending-up', route: '/progress' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person', route: '/profile' },
];

function TabItem({ tab, isActive, onPress, isCenter }) {
  if (isCenter) {
    return (
      <Pressable style={styles.tabCenter} onPress={onPress} accessibilityRole="button" accessibilityLabel={"Navigate to " + tab.label}>
        <View style={styles.centerBadge}>
          <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={24} color="#FFF" />
        </View>
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="button" accessibilityLabel={"Navigate to " + tab.label}>
      <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={22} color={isActive ? '#000' : '#999'} />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  /* ââ Pick tab config based on current screen ââ */
  const isWorkoutContext = useMemo(() => {
    return (
      pathname.startsWith('/workout') ||
      pathname.startsWith('/running') ||
      pathname.startsWith('/badges') ||
      pathname.startsWith('/analytics') ||
      pathname.startsWith('/challenges')
    );
  }, [pathname]);

  const isHealthContext = useMemo(() => {
    return (
      pathname.startsWith('/health') ||
      pathname.startsWith('/calendar') ||
      pathname.startsWith('/recipes') ||
      pathname.startsWith('/nutrition')
    );
  }, [pathname]);

  const isProfileContext = useMemo(() => {
    return (
      pathname.startsWith('/profile') ||
      pathname.startsWith('/social') ||
      pathname.startsWith('/achievements') ||
      pathname.startsWith('/battlepass') ||
      pathname.startsWith('/progress')
    );
  }, [pathname]);

  const tabs = isWorkoutContext ? WORKOUT_TABS : isHealthContext ? HEALTH_TABS : isProfileContext ? PROFILE_TABS : HOME_TABS;

  /* ââ Active tab detection ââ */
  const activeKey = useMemo(() => {
    if (pathname === '/hq' || pathname === '/') return 'home';

    if (isWorkoutContext) {
      if (pathname.startsWith('/workout')) return 'workouts';
      if (pathname.startsWith('/running')) return 'running';
      if (pathname.startsWith('/badges') || pathname.startsWith('/challenges')) return 'challenges';
      if (pathname.startsWith('/analytics')) return 'analysis';
    } else if (isHealthContext) {
      if (pathname.startsWith('/health')) return 'health';
      if (pathname.startsWith('/calendar')) return 'calendar';
      if (pathname.startsWith('/recipes')) return 'recipes';
      if (pathname.startsWith('/nutrition')) return 'nutrition';
    } else if (isProfileContext) {
      if (pathname.startsWith('/achievements')) return 'achievements';
      if (pathname.startsWith('/battlepass')) return 'battlepass';
      if (pathname.startsWith('/progress')) return 'progress';
      if (pathname.startsWith('/profile')) return 'profile';
    } else {
      if (pathname.startsWith('/workout')) return 'workouts';
      if (pathname.startsWith('/nutrition')) return 'nutrition';
      if (pathname.startsWith('/shop')) return 'shop';
      if (pathname.startsWith('/profile')) return 'profile';
    }

    return 'home';
  }, [pathname, isWorkoutContext, isHealthContext, isProfileContext]);

  const handleTabPress = useCallback(
    (route) => {
      if (route === pathname) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Fallback for haptic errors
      }
      router.push(route);
    },
    [pathname, router],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {tabs.map((tab, idx) => (
          <TabItem
            key={tab.key}
            tab={tab}
            isActive={activeKey === tab.key}
            isCenter={idx === 2}
            onPress={() => handleTabPress(tab.route)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
    }),
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tabCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -22,
  },
  centerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#000',
    fontWeight: '700',
  },
});
