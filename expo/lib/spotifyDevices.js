// lib/spotifyDevices.js
//
// Pure helpers for starting Spotify playback from inside Zown.
//
// Why this exists: Spotify has no embeddable player for iOS apps (unlike
// Apple's MusicKit). Zown can only remote-control the Spotify app through
// the Web API, which needs a "device" - the Spotify app running on this
// phone (or another device) - and answers 404 NO_ACTIVE_DEVICE otherwise.
// These helpers decide which device to use so Zown can start playback by
// itself instead of asking the user to play something in Spotify first.

// Spotify answers play requests with HTTP 404, reason NO_ACTIVE_DEVICE and
// the message "Player command failed: No active device found" when nothing
// is able to receive playback.
export function isNoDeviceError(error) {
  if (!error) return false;
  if (error.reason === 'NO_ACTIVE_DEVICE') return true;
  return /no active device/i.test(String(error.message || ''));
}

// Chooses which of the account's Spotify devices should play, from the
// /me/player/devices list. Restricted devices (which refuse remote
// control) are never chosen. Preference: the device that is already
// playing, then the one Zown used last time, then a phone/tablet, then
// whatever is left.
export function pickDevice(devices, lastDeviceId) {
  const usable = (Array.isArray(devices) ? devices : []).filter((d) => d && d.id && !d.is_restricted);
  if (usable.length === 0) return null;
  return (
    usable.find((d) => d.is_active) ||
    usable.find((d) => lastDeviceId && d.id === lastDeviceId) ||
    usable.find((d) => /smartphone|tablet/i.test(d.type || '')) ||
    usable[0]
  );
}
