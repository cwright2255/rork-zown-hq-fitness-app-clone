import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, Utensils, ShoppingBag, User } from 'lucide-react-native';
import Colors from '@/constants/colors';

// Memoized tabs configuration outside component to prevent recreation
const tabs = [
  {
    name: 'HQ',
    icon: Home,
    route: '/hq',
  },
  {
    name: 'Workouts',
    icon: Dumbbell,
    route: '/workouts',
  },
  {
    name: 'Nutrition',
    icon: Utensils,
    route: '/nutrition',
  },
  {
    name: 'Shop',
    icon: ShoppingBag,
    route: '/shop',
  },
  {
    name: 'Profile',
    icon: User,
    route: '/profile',
  },
] as const;

// Memoized tab component to prevent unnecessary re-renders
const TabItem = React.memo(({ tab, isActive, onPress }: {
  tab: typeof tabs[0];
  isActive: boolean;
  onPress: () => void;
}) => {
  const Icon = tab.icon;
  
  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${tab.name}`}
    >
      <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
        <Icon 
          size={24} 
          color={isActive ? Colors.primary : Colors.text.secondary} 
        />
      </View>
      <Text style={[styles.label, isActive && styles.activeLabel]}>
        {tab.name}
      </Text>
    </TouchableOpacity>
  );
});

const BottomNavigation = React.memo(() => {
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the active state calculation
  const isActive = useCallback((route: string) => {
    if (route === '/hq') {
      return pathname === '/hq' || pathname === '/';
    }
    return pathname === route || pathname.startsWith(route + '/');
  }, [pathname]);

  // Memoize navigation handler with requestAnimationFrame for better performance
  const handleNavigation = useCallback((route: string) => {
    requestAnimationFrame(() => {
      router.push(route);
    });
  }, [router]);

  // Memoize tabs with active states to prevent recalculation
  const tabsWithActiveState = useMemo(() => 
    tabs.map(tab => ({
      ...tab,
      isActive: isActive(tab.route)
    })),
    [isActive]
  );

  return (
    <View style={styles.container}>
      {tabsWithActiveState.map((tab) => (
        <TabItem
          key={tab.name}
          tab={tab}
          isActive={tab.isActive}
          onPress={() => handleNavigation(tab.route)}
        />
      ))}
    </View>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

export default BottomNavigation;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeIconContainer: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeLabel: {
    color: Colors.primary,
    fontWeight: '600',
  },
});