import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Bell, Clock, Users, Trophy, Droplets } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { notificationService, NotificationSettings } from '@/services/notificationService';
import { useUserStore } from '@/store/userStore';

export default function NotificationsScreen() {
  const { user, setUser } = useUserStore();
  const [settings, setSettings] = useState<NotificationSettings>({
    workouts: user?.preferences.notifications.workouts ?? true,
    nutrition: user?.preferences.notifications.nutrition ?? true,
    social: user?.preferences.notifications.social ?? true,
    achievements: true,
    reminders: true,
  });
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    checkPermissions();
    notificationService.setupNotificationHandler();
  }, []);

  const checkPermissions = async () => {
    const granted = await notificationService.requestPermissions();
    setPermissionGranted(granted);
    
    if (!granted) {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your device settings to receive workout reminders and updates.',
        [{ text: 'OK' }]
      );
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Update user preferences
    if (user && (key === 'workouts' || key === 'nutrition' || key === 'social')) {
      setUser({
        ...user,
        preferences: {
          ...user.preferences,
          notifications: {
            ...user.preferences.notifications,
            [key]: value,
          },
        },
      });
    }
  };

  const scheduleTestNotification = async () => {
    if (!permissionGranted) {
      Alert.alert('Error', 'Notifications are not enabled');
      return;
    }

    await notificationService.sendAchievementNotification('Test Achievement');
    Alert.alert('Success', 'Test notification sent!');
  };

  const notificationTypes = [
    {
      key: 'workouts' as keyof NotificationSettings,
      title: 'Workout Reminders',
      description: 'Get notified about scheduled workouts and rest days',
      icon: <Clock size={24} color={Colors.primary.main} />,
    },
    {
      key: 'nutrition' as keyof NotificationSettings,
      title: 'Nutrition Tracking',
      description: 'Reminders to log meals and track water intake',
      icon: <Droplets size={24} color={Colors.primary.main} />,
    },
    {
      key: 'social' as keyof NotificationSettings,
      title: 'Social Updates',
      description: 'Likes, comments, and friend activity notifications',
      icon: <Users size={24} color={Colors.primary.main} />,
    },
    {
      key: 'achievements' as keyof NotificationSettings,
      title: 'Achievements & Badges',
      description: 'Celebrate your fitness milestones and unlocked badges',
      icon: <Trophy size={24} color={Colors.primary.main} />,
    },
    {
      key: 'reminders' as keyof NotificationSettings,
      title: 'General Reminders',
      description: 'Daily check-ins, hydration, and app usage reminders',
      icon: <Bell size={24} color={Colors.primary.main} />,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Notification Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {!permissionGranted && (
          <View style={styles.warningCard}>
            <Bell size={24} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Notifications Disabled</Text>
              <Text style={styles.warningText}>
                Enable notifications in your device settings to receive reminders and updates.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Notification Types</Text>

        {notificationTypes.map((type) => (
          <View key={type.key} style={styles.settingItem}>
            <View style={styles.settingInfo}>
              {type.icon}
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{type.title}</Text>
                <Text style={styles.settingDescription}>{type.description}</Text>
              </View>
            </View>
            
            <Switch
              value={settings[type.key]}
              onValueChange={(value) => updateSetting(type.key, value)}
              trackColor={{ false: Colors.background.secondary, true: Colors.primary.main + '40' }}
              thumbColor={settings[type.key] ? Colors.primary.main : Colors.text.secondary}
            />
          </View>
        ))}

        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Quick Schedule</Text>
          
          <TouchableOpacity style={styles.scheduleButton}>
            <Clock size={20} color={Colors.primary.main} />
            <Text style={styles.scheduleButtonText}>Set Workout Reminders</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.scheduleButton}>
            <Droplets size={20} color={Colors.primary.main} />
            <Text style={styles.scheduleButtonText}>Schedule Hydration Reminders</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>Test Notifications</Text>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={scheduleTestNotification}
          >
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Notifications</Text>
          <Text style={styles.infoText}>
            Notifications help you stay on track with your fitness goals. You can customize 
            which types of notifications you receive and when you receive them.
          </Text>
          <Text style={styles.infoText}>
            • Workout reminders help maintain consistency{'\n'}
            • Nutrition tracking keeps you accountable{'\n'}
            • Social updates keep you connected with your fitness community{'\n'}
            • Achievement notifications celebrate your progress
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
    marginTop: 8,
  },
  settingItem: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  scheduleSection: {
    marginTop: 24,
  },
  scheduleButton: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  testSection: {
    marginTop: 24,
  },
  testButton: {
    backgroundColor: Colors.primary.main,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
});