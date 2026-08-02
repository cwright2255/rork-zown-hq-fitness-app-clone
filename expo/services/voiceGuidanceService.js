// services/voiceGuidanceService.js
//
// Thin wrapper around expo-speech (already an installed dependency — no new
// native module needed for this) for the body-scan capture flow's spoken
// prompts, plus a persisted on/off preference so the toggle in the capture
// screen survives app restarts.

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'zown:bodyScan:voiceGuidanceEnabled';

let enabledCache = true; // optimistic default while AsyncStorage read resolves

export async function loadVoiceGuidancePreference() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    enabledCache = stored === null ? true : stored === 'true';
  } catch (e) {
    console.warn('[voiceGuidance] failed to load preference, defaulting to on:', e?.message);
    enabledCache = true;
  }
  return enabledCache;
}

export async function setVoiceGuidanceEnabled(enabled) {
  enabledCache = enabled;
  if (!enabled) Speech.stop();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (e) {
    console.warn('[voiceGuidance] failed to persist preference:', e?.message);
  }
}

export function isVoiceGuidanceEnabled() {
  return enabledCache;
}

/**
 * Speaks a prompt if voice guidance is enabled. Interrupts any in-progress
 * speech first — step transitions and "turn slower" corrections should
 * always be heard immediately, not queued up behind a stale prompt.
 */
export function speakPrompt(text, options = {}) {
  if (!enabledCache) return;
  Speech.stop();
  Speech.speak(text, { rate: 0.95, pitch: 1.0, ...options });
}

export function stopSpeaking() {
  Speech.stop();
}
