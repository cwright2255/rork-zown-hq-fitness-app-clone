// lib/openDirections.js
//
// Opens the device's native maps app with navigation pre-loaded to a real
// trailhead/parking lot coordinate - Apple Maps on iOS, Google Maps on
// Android, matching how every real navigation hand-off in a mobile app
// works (this is the same mechanism Yelp, AllTrails, etc. use, not a
// custom map view Zown has to build and maintain itself).

import { Platform, Linking, Alert } from 'react-native';

/**
 * @param {{ latitude: number, longitude: number, label?: string, mode?: 'driving'|'walking' }} destination
 */
export async function openDirections({ latitude, longitude, label = 'Trailhead', mode = 'driving' }) {
  if (latitude == null || longitude == null) {
    Alert.alert("Can't get directions", 'This trail has no location data yet.');
    return;
  }

  const encodedLabel = encodeURIComponent(label);
  const iosMode = mode === 'walking' ? 'w' : 'd';
  const androidMode = mode === 'walking' ? 'walking' : 'driving';

  // Try the native app URL scheme first (opens the actual app, not a
  // browser tab); fall back to the universal web URL, which still opens
  // the native app on both platforms if it's installed, or the browser
  // if not - so this always gets the user *somewhere* usable.
  const nativeUrl = Platform.select({
    ios: `maps://app?daddr=${latitude},${longitude}&dirflg=${iosMode}&q=${encodedLabel}`,
    android: `google.navigation:q=${latitude},${longitude}&mode=${mode === 'walking' ? 'w' : 'd'}`,
    default: null,
  });
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=&travelmode=${androidMode}`;

  try {
    if (nativeUrl) {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
        return;
      }
    }
    await Linking.openURL(webUrl);
  } catch (e) {
    console.error('[openDirections] failed to open maps:', e?.message);
    Alert.alert("Couldn't open maps", 'Please try again.');
  }
}

/**
 * Presents the drive/walk choice before opening directions - the running
 * section cares about both (driving to a trailhead vs. a trail close
 * enough to walk to), unlike a typical business-listing "get directions"
 * button which only ever means driving.
 */
export function promptDirections(destination) {
  Alert.alert(
    'Get Directions',
    `Navigate to ${destination.label || 'this trail'}`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Walk', onPress: () => openDirections({ ...destination, mode: 'walking' }) },
      { text: 'Drive', onPress: () => openDirections({ ...destination, mode: 'driving' }) },
    ]
  );
}
