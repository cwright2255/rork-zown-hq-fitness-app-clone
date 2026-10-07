// components/MediaPickerStrip.jsx
//
// The "add photos or video" row for a post composer: a library button, a
// camera button, a hint, and previews of what has been chosen (with a remove
// button on each). The parent owns the list of items and gets every change
// through onChange.

import React from 'react';
import { View, Text, Image, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickFromLibrary, capturePhoto } from '../services/postMediaService';
import {
  addPicked, removeAt, remainingPhotos, pickerHint, formatDuration,
} from '../lib/postMedia';

export default function MediaPickerStrip({ items, onChange, disabled }) {
  const list = Array.isArray(items) ? items : [];
  const full = remainingPhotos(list) === 0;

  const apply = (assets) => {
    if (!assets || assets.length === 0) return;
    const { items: next, rejected } = addPicked(list, assets);
    onChange(next);
    if (rejected.length > 0) Alert.alert("Some files weren't added", rejected.join('\n'));
  };

  const onLibrary = async () => {
    try {
      const assets = await pickFromLibrary({ selectionLimit: Math.max(1, remainingPhotos(list)) });
      apply(assets);
    } catch (e) {
      console.warn('[MediaPickerStrip] library failed', e?.message);
      Alert.alert("Couldn't open your photos", 'Check that Zown HQ can access your photos in Settings, then try again.');
    }
  };

  const onCamera = async () => {
    try {
      const { denied, assets } = await capturePhoto();
      if (denied) {
        Alert.alert('Camera access needed', 'Allow camera access for Zown HQ in Settings to take a photo.');
        return;
      }
      apply(assets);
    } catch (e) {
      console.warn('[MediaPickerStrip] camera failed', e?.message);
      Alert.alert("Couldn't open the camera", 'Please try again.');
    }
  };

  const blocked = disabled || full;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onLibrary}
          disabled={blocked}
          style={[styles.btn, blocked && styles.btnOff]}
          accessibilityRole="button"
          accessibilityLabel="Add photos or video"
        >
          <Ionicons name="images-outline" size={18} color="#000" />
          <Text style={styles.btnText}>Photo / Video</Text>
        </Pressable>
        <Pressable
          onPress={onCamera}
          disabled={blocked}
          style={[styles.btn, blocked && styles.btnOff]}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
        >
          <Ionicons name="camera-outline" size={18} color="#000" />
          <Text style={styles.btnText}>Camera</Text>
        </Pressable>
        <Text style={styles.hint} numberOfLines={2}>{pickerHint(list)}</Text>
      </View>

      {list.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previews} contentContainerStyle={{ gap: 8 }}>
          {list.map((item, i) => (
            <View key={item.uri} style={styles.preview}>
              {item.kind === 'video' ? (
                <View style={[styles.previewImg, styles.videoPreview]}>
                  <Ionicons name="play" size={22} color="#FFF" />
                  {!!item.durationMs && <Text style={styles.videoLen}>{formatDuration(item.durationMs)}</Text>}
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.previewImg} />
              )}
              {!disabled && (
                <Pressable
                  onPress={() => onChange(removeAt(list, i))}
                  style={styles.remove}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E5E5',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF',
  },
  btnOff: { opacity: 0.4 },
  btnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  hint: { flex: 1, fontSize: 11, color: '#999', textAlign: 'right' },
  previews: { marginTop: 12 },
  preview: { width: 76, height: 76 },
  previewImg: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#F0F0F0' },
  videoPreview: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  videoLen: { color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: 2 },
  remove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
});
