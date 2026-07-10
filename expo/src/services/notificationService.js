import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return null;
  }
  
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: '97962c67-b686-4470-9dd8-8e874d90b279'
  })).data;
  
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  
  return token;
}

export async function scheduleWorkoutReminder(hour = 9, minute = 0) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to work out! 💪",
      body: "Your daily workout is waiting. Own the day!",
      data: { screen: '/workouts' },
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function scheduleHydrationReminder() {
  // Every 2 hours between 8am and 8pm
  for (let hour = 8; hour <= 20; hour += 2) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Stay hydrated! 💧",
        body: "Don't forget to drink water. Tap to log.",
        data: { screen: '/nutrition' },
      },
      trigger: {
        hour,
        minute: 0,
        repeats: true,
      },
    });
  }
}

export async function scheduleStreakReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't break your streak! 🔥",
      body: "You haven't worked out today. Keep the streak alive!",
      data: { screen: '/workouts' },
    },
    trigger: {
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
