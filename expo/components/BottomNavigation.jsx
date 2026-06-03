import React, { useMemo, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { key: 'workouts', label: 'Workouts', icon: 'barbell-outline', activeIcon: 'barbell', route: '/workouts' },
  { key: 'running', label: 'Running', icon: 'fitness-outline', activeIcon: 'fitness', route: '/running/program' },
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/hq' },
  { key: 'challenges', label: 'Challenges', icon: 'trophy-outline', activeIcon: 'trophy', route: '/badges' },
  { key: 'analysis', label: 'Analysis', icon: 'analytics-outline', activeIcon: 'analytics', route: '/analytics' },
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

  const activeKey = useMemo(() => {
    if (pathname === '/hq' || pathname === '/') return 'home';
    if (pathname.startsWith('/workout')) return 'workouts';
    if (pathname.startsWith('/running')) return 'running';
    if (pathname.startsWith('/badges')) return 'challenges';
    if (pathname.startsWith('/analytics')) return 'analysis';
    return 'home';
  }, [pathname]);

  const navigate = useCallback((route) => {
    router.push(route);
  }, [router]);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          isActive={activeKey === tab.key}
          isCenter={tab.key === 'home'}
          onPress={() => navigate(tab.route)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 6,
  },
  tabCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -20,
  },
  centerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    fontWeight: '400',
  },
  tabLabelActive: {
    color: '#000',
    fontWeight: '700',
  },
});
