import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

class NotificationService {
  async requestPermissions() {
    if (Platform.OS === 'web') {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  setupNotificationHandler() {
    if (Platform.OS === 'web') {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  async sendWorkoutReminder(workoutName, scheduledTime) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Workout Reminder',
        body: `Time for your ${workoutName} workout!`,
        data: { type: 'workout' },
      },
      trigger: {
        type: 'date',
        date: scheduledTime,
      },
    });
  }

  async sendNutritionReminder(mealType, scheduledTime) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Nutrition Reminder',
        body: `Don't forget to log your ${mealType}!`,
        data: { type: 'nutrition' },
      },
      trigger: {
        type: 'date',
        date: scheduledTime,
      },
    });
  }

  async sendAchievementNotification(achievementName) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Achievement Unlocked! 🏆',
        body: `Congratulations! You've earned: ${achievementName}`,
        data: { type: 'achievement' },
      },
      trigger: null,
    });
  }

  async sendSocialNotification(message) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Social Update',
        body: message,
        data: { type: 'social' },
      },
      trigger: null,
    });
  }

  async scheduleHydrationReminder() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hydration Reminder 💧',
        body: 'Time to drink some water!',
        data: { type: 'hydration' },
      },
      trigger: {
        type: 'timeInterval',
        seconds: 3600, // Every hour
        repeats: true,
      },
    });
  }

  async scheduleDailyCheckIn() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Check-in',
        body: 'How are you feeling today? Log your mood and progress!',
        data: { type: 'checkin' },
      },
      trigger: {
        type: 'daily',
        hour: 9,
        minute: 0,
        repeats: true,
      },
    });
  }

  async cancelAllNotifications() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async cancelNotificationsByType(type) {
    if (Platform.OS === 'web') {
      return;
    }

    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const notificationsToCancel = scheduledNotifications.filter(
      notification => notification.content.data?.type === type
    );

    for (const notification of notificationsToCancel) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

export const notificationService = new NotificationService();