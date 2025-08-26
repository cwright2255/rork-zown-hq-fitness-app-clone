import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, ScrollView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { X, Home, Dumbbell, Utensils, TrendingUp, ShoppingBag, Trophy, Soup, User, MessageCircle, Brain, Heart, Activity, LogOut } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  route: string;
};

type HamburgerMenuProps = {
  isVisible: boolean;
  onClose: () => void;
};

const { width } = Dimensions.get('window');

// Memoized menu items to prevent recreation on every render
const menuItems: MenuItem[] = [
  {
    icon: <Home size={24} color={Colors.text.primary} />,
    label: 'HQ',
    route: '/hq',
  },
  {
    icon: <Dumbbell size={24} color={Colors.text.primary} />,
    label: 'Workouts',
    route: '/workouts',
  },
  {
    icon: <Utensils size={24} color={Colors.text.primary} />,
    label: 'Nutrition',
    route: '/nutrition',
  },
  {
    icon: <TrendingUp size={24} color={Colors.text.primary} />,
    label: 'Analytics',
    route: '/analytics',
  },
  {
    icon: <ShoppingBag size={24} color={Colors.text.primary} />,
    label: 'Shop',
    route: '/shop',
  },
  {
    icon: <Trophy size={24} color={Colors.text.primary} />,
    label: 'Leaderboard',
    route: '/leaderboard',
  },
  {
    icon: <Soup size={24} color={Colors.text.primary} />,
    label: 'Recipes',
    route: '/recipes',
  },
  {
    icon: <MessageCircle size={24} color={Colors.text.primary} />,
    label: 'Messages',
    route: '/messaging',
  },
  {
    icon: <Brain size={24} color={Colors.text.primary} />,
    label: 'Mood Tracking',
    route: '/mood-tracking',
  },
  {
    icon: <Heart size={24} color={Colors.text.primary} />,
    label: 'Health Assessment',
    route: '/health-assessment',
  },
  {
    icon: <Activity size={24} color={Colors.text.primary} />,
    label: 'Wearables',
    route: '/wearables',
  },
  {
    icon: <User size={24} color={Colors.text.primary} />,
    label: 'Profile',
    route: '/profile',
  },
];

const HamburgerMenu = React.memo(({ isVisible, onClose }: HamburgerMenuProps) => {
  const slideAnim = React.useRef(new Animated.Value(-width)).current;
  const { logout } = useUserStore();

  React.useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleNavigation = React.useCallback((route: string) => {
    // Close the menu first to prevent animation glitches
    onClose();
    
    // Use requestAnimationFrame for better performance instead of setTimeout
    requestAnimationFrame(() => {
      setTimeout(() => {
        router.push(route);
      }, 300);
    });
  }, [onClose]);

  const handleLogout = React.useCallback(() => {
    onClose();
    
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[HamburgerMenu] Starting logout process');
              
              // Clear auth service token first
              await authService.logout();
              
              // Clear user store and persisted data
              await logout();
              
              console.log('[HamburgerMenu] Logout completed, navigating to index');
              
              // Navigate to index which will handle the redirect to start screen
              router.replace('/');
              
            } catch (e) {
              console.error('[HamburgerMenu] Logout error:', e);
              // Even if there's an error, still navigate to index
              router.replace('/');
            }
          },
        },
      ],
    );
  }, [logout, onClose]);

  // Memoized MenuItem component
  const MenuItem = React.memo(({ item, onPress }: {
    item: MenuItem;
    onPress: (route: string) => void;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => onPress(item.route)}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${item.label}`}
    >
      <View style={styles.iconContainer}>
        {item.icon}
      </View>
      <Text style={styles.menuItemText}>{item.label}</Text>
    </TouchableOpacity>
  ));
  
  MenuItem.displayName = 'MenuItem';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          onPress={onClose} 
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        
        <Animated.View 
          style={[
            styles.menuContainer,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Menu</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <View style={styles.closeIconContainer}>
                <X size={24} color={Colors.text.primary} />
              </View>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.menuItems} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuItemsContent}
          >
            {menuItems.map((item, index) => (
              <MenuItem
                key={item.route} // Use route as key for better performance
                item={item}
                onPress={handleNavigation}
              />
            ))}
            
            {/* Logout Button */}
            <TouchableOpacity
              style={[styles.menuItem, styles.logoutItem]}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <View style={[styles.iconContainer, styles.logoutIconContainer]}>
                <LogOut size={24} color={Colors.error} />
              </View>
              <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

HamburgerMenu.displayName = 'HamburgerMenu';

export default HamburgerMenu;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.75,
    maxWidth: 300,
    height: '100%',
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 8,
  },
  closeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItems: {
    flex: 1,
    backgroundColor: Colors.card,
  },
  menuItemsContent: {
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderRadius: 22,
    backgroundColor: Colors.background,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  logoutItem: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 0,
  },
  logoutIconContainer: {
    backgroundColor: Colors.background,
  },
  logoutText: {
    color: Colors.error,
    fontWeight: '600' as const,
  },
});