import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * The bookmark on a recipe card. state is 'idle' (not saved), 'saving' (being saved, tapping does nothing) or 'saved'.
 * onPress is called with no arguments; the screen decides whether that saves or removes.
 */
export default function SaveButton({ state = 'idle', onPress, name, id, style }) {
  const saved = state === 'saved';
  const saving = state === 'saving';
  return (
    <Pressable
      testID={`save-${id}`}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${name} from saved recipes` : `Save ${name}`}
      accessibilityState={{ selected: saved, busy: saving, disabled: saving }}
      disabled={saving}
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, style]}>
      {saving ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color="#000" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
});
