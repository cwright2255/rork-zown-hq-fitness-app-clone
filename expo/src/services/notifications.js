import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return false;
}

export async function registerForPushNotifications(userId) {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH
      });
    }

    const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = token.data;
    if (!pushToken) return null;

    await setDoc(
      doc(db, 'users', userId, 'devices', pushToken),
      {
        token: pushToken,
        platform: Platform.OS,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return pushToken;
  } catch (err) {
    if (__DEV__) console.warn('registerForPushNotifications failed', err);
    return null;
  }
}

export function addForegroundHandler(
handler)
{
  const sub = Notifications.addNotificationReceivedListener(handler);
  return () => sub.remove();
}

export function addResponseHandler(
handler)
{
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}