/**
 * @fileoverview BottomTabBar component for the Fitleus fitness app UI kit.
 *
 * @description
 * A custom 5-tab bottom navigation bar featuring:
 * - Home, Workouts, + (center FAB), Nutrition, and Profile tabs
 * - Dark surface with accent-colored active state
 * - Animated center FAB with orange accent
 * - Smooth active indicator styling
 *
 * @prop {string} activeTab - The currently active tab key ('home' | 'workouts' | 'add' | 'nutrition' | 'profile')
 * @prop {function} onTabPress - Callback fired when a tab is pressed: (tabKey: string) => void
 * @prop {object} style - Optional additional styles for the container
 *
 * @example
 * // Usage example:
 * import BottomTabBar from './components/navigation/BottomTabBar';
 *
 * const MyApp = () => {
 *   const [activeTab, setActiveTab] = React.useState('home');
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <View style={{ flex: 1 }}>
 *         {/* screen content */}
 *       </View>
 *       <BottomTabBar
 *         activeTab={activeTab}
 *         onTabPress={(tab) => setActiveTab(tab)}
 *       />
 *     </View>
 *   );
 * };
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { tokens } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Icon primitives (pure RN Ã¢ÂÂ no external lib required)
// ---------------------------------------------------------------------------

const HomeIcon = ({ color, size = 22 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {/* Roof triangle */}
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.45,
        borderRightWidth: size * 0.45,
        borderBottomWidth: size * 0.5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        marginBottom: -2,
      }}
    />
    {/* Body */}
    <View
      style={{
        width: size * 0.62,
        height: size * 0.45,
        backgroundColor: color,
        borderRadius: 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {/* Door */}
      <View
        style={{
          width: size * 0.24,
          height: size * 0.26,
          backgroundColor: tokens.colors.ink.darker,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          marginBottom: 0,
        }}
      />
    </View>
  </View>
);

const WorkoutsIcon = ({ color, size = 22 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {/* Dumbbell bar */}
    <View
      style={{
        width: size * 0.85,
        height: size * 0.18,
        backgroundColor: color,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      {/* Left weight */}
      <View
        style={{
          width: size * 0.22,
          height: size * 0.45,
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
      {/* Right weight */}
      <View
        style={{
          width: size * 0.22,
          height: size * 0.45,
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  </View>
);

const NutritionIcon = ({ color, size = 22 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {/* Apple shape */}
    <View
      style={{
        width: size * 0.7,
        height: size * 0.72,
        backgroundColor: color,
        borderRadius: size * 0.35,
        borderTopLeftRadius: size * 0.2,
        borderTopRightRadius: size * 0.2,
        marginTop: size * 0.1,
      }}
    />
    {/* Stem */}
    <View
      style={{
        position: 'absolute',
        top: 0,
        width: size * 0.1,
        height: size * 0.22,
        backgroundColor: color,
        borderRadius: 2,
      }}
    />
  </View>
);

const ProfileIcon = ({ color, size = 22 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {/* Head */}
    <View
      style={{
        width: size * 0.4,
        height: size * 0.4,
        borderRadius: size * 0.2,
        backgroundColor: color,
        marginBottom: 2,
      }}
    />
    {/* Shoulders */}
    <View
      style={{
        width: size * 0.7,
        height: size * 0.32,
        borderTopLeftRadius: size * 0.35,
        borderTopRightRadius: size * 0.35,
        backgroundColor: color,
      }}
    />
  </View>
);

const PlusIcon = ({ size = 26 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View
      style={{
        position: 'absolute',
        width: size * 0.65,
        height: size * 0.12,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
      }}
    />
    <View
      style={{
        position: 'absolute',
        width: size * 0.12,
        height: size * 0.65,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
      }}
    />
  </View>
);

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'home',      label: 'Home',      Icon: HomeIcon },
  { key: 'workouts',  label: 'Workouts',  Icon: WorkoutsIcon },
  { key: 'add',       label: null,        Icon: null },   // center FAB
  { key: 'nutrition', label: 'Nutrition', Icon: NutritionIcon },
  { key: 'profile',   label: 'Profile',   Icon: ProfileIcon },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TabItem = ({ tab, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.55)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1.08 : 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: isActive ? 1 : 0.55,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1.08 : 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 220,
      }),
    ]).start();
    onPress(tab.key);
  };

  const iconColor = isActive ? tokens.colors.accent.cyan : tokens.colors.ink.muted;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View
        style={[
          styles.tabInner,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        {isActive && (
          <View style={styles.activeIndicator} />
        )}
        <View style={styles.iconWrap}>
          <tab.Icon color={iconColor} size={22} />
        </View>
        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CenterFAB = ({ onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
          stiffness: 250,
        }),
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    if (onPress) onPress('add');
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add new"
        style={styles.fabTouchable}
      >
        <Animated.View
          style={[
            styles.fabButton,
            { transform: [{ scale: scaleAnim }, { rotate }] },
          ]}
        >
          {/* Glow ring */}
          <View style={styles.fabGlow} />
          <PlusIcon size={28} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BottomTabBar = ({
  activeTab = 'home',
  onTabPress = () => {},
  style,
}) => {
  return (
    <View style={[styles.wrapper, style]}>
      {/* Top border accent line */}
      <View style={styles.topBorderLine} />

      <View style={styles.container}>
        {TABS.map((tab) => {
          if (tab.key === 'add') {
            return (
              <CenterFAB
                key={tab.key}
                onPress={onTabPress}
              />
            );
          }
          return (
            <TabItem
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onPress={onTabPress}
            />
          );
        })}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FAB_SIZE = 60;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: tokens.colors.ink.darker,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  topBorderLine: {
    height: 1,
    marginHorizontal: tokens.spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.xl + 4 : tokens.spacing.md,
    backgroundColor: 'transparent',
  },

  // Regular tab
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    position: 'relative',
    minWidth: 52,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: tokens.colors.accent.cyan,
  },
  tabLabelInactive: {
    color: tokens.colors.ink.muted,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 2.5,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accent.cyan,
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.accent.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      },
    }),
  },

  // FAB
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  fabTouchable: {
    marginTop: -(FAB_SIZE * 0.4),
    overflow: 'visible',
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: tokens.colors.accent.orange,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: tokens.colors.accent.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.65,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  fabGlow: {
    position: 'absolute',
    width: FAB_SIZE + 16,
    height: FAB_SIZE + 16,
    borderRadius: (FAB_SIZE + 16) / 2,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 87, 34, 0.30)',
  },
});

export default BottomTabBar;
