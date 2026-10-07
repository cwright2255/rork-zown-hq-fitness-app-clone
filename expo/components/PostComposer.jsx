// components/PostComposer.jsx
//
// The full-screen "Create Post" screen shared by app/social.jsx and
// app/community.jsx: close button, title and a Post pill in the header, the
// author's avatar and name, a big borderless text box, previews of the chosen
// photos or video, and a photo / camera toolbar that sits above the keyboard.
// The parent owns the text, the picked media and the posting state.
//
// Colors follow the rest of the app (black and white, #F0F0F0 surfaces,
// #E5E5E5 hairlines, black pill buttons).

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Modal, Pressable, ScrollView, Image, Alert, Keyboard,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pickFromLibrary, capturePhoto } from '../services/postMediaService';
import {
  addPicked, removeAt, remainingPhotos, pickerHint, formatDuration, canPost,
  initialsFor, progressPercent, uploadLabel,
} from '../lib/postMedia';

const IOS = Platform.OS === 'ios';

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(IOS ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener(IOS ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return up;
}

export default function PostComposer({
  visible, onClose, authorName, text, onChangeText, items, onChangeItems, posting, progress, onSubmit,
}) {
  const list = Array.isArray(items) ? items : [];
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const { width } = useWindowDimensions();
  const tile = Math.max(88, Math.min(128, Math.floor((width - 40 - 20) / 3))); // three previews fit across

  const ready = canPost(text, list);
  const full = remainingPhotos(list) === 0;
  const locked = !!posting || full;

  const apply = (assets) => {
    if (!assets || assets.length === 0) return;
    const { items: next, rejected } = addPicked(list, assets);
    onChangeItems(next);
    if (rejected.length > 0) Alert.alert("Some files weren't added", rejected.join('\n'));
  };

  const onLibrary = async () => {
    try {
      const assets = await pickFromLibrary({ selectionLimit: Math.max(1, remainingPhotos(list)) });
      apply(assets);
    } catch (e) {
      console.warn('[PostComposer] library failed', e?.message);
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
      console.warn('[PostComposer] camera failed', e?.message);
      Alert.alert("Couldn't open the camera", 'Please try again.');
    }
  };

  const bottomPad = IOS && !keyboardUp ? Math.max(insets.bottom, 10) : 10;

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.flex} behavior={IOS ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              disabled={!!posting}
              hitSlop={12}
              style={[styles.closeBtn, posting && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color="#000" />
            </Pressable>
            <Text style={styles.title} pointerEvents="none">Create Post</Text>
            <Pressable
              onPress={onSubmit}
              disabled={!ready || !!posting}
              style={[styles.postBtn, ready ? styles.postBtnOn : styles.postBtnOff]}
              accessibilityRole="button"
              accessibilityLabel="Post"
            >
              {posting
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={[styles.postBtnText, ready ? styles.postTextOn : styles.postTextOff]}>Post</Text>}
            </Pressable>
            {posting ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${list.length > 0 ? Math.max(4, progressPercent(progress)) : 100}%` }]} />
              </View>
            ) : null}
          </View>

          {/* Body: the text box takes the free space, previews sit right above the toolbar */}
          <View style={styles.body}>
            <View style={styles.author}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsFor(authorName)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.authorName} numberOfLines={1}>{authorName || 'Zown User'}</Text>
                <Text style={styles.audience}>{posting ? uploadLabel(list, progress) : 'Shared with the Zown community'}</Text>
              </View>
            </View>

            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder="What's on your mind?"
              placeholderTextColor="#999"
              style={styles.input}
              multiline
              autoFocus
              editable={!posting}
              textAlignVertical="top"
            />

            {list.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previews} contentContainerStyle={styles.previewRow}>
                {list.map((item, i) => (
                  <View key={item.uri} style={{ width: tile, height: tile }}>
                    {item.kind === 'video' ? (
                      <View style={[styles.previewBox, { width: tile, height: tile }, styles.videoBox]}>
                        <Ionicons name="play" size={30} color="#FFF" />
                        {!!item.durationMs && <Text style={styles.videoLen}>{formatDuration(item.durationMs)}</Text>}
                      </View>
                    ) : (
                      <Image source={{ uri: item.uri }} style={[styles.previewBox, { width: tile, height: tile }]} />
                    )}
                    {!posting && (
                      <Pressable
                        onPress={() => onChangeItems(removeAt(list, i))}
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

          {/* Toolbar */}
          <View style={[styles.toolbar, { paddingBottom: bottomPad }]}>
            <Pressable
              onPress={onLibrary}
              disabled={locked}
              style={[styles.chip, locked && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Add photos or video"
            >
              <Ionicons name="images-outline" size={21} color="#000" />
            </Pressable>
            <Pressable
              onPress={onCamera}
              disabled={locked}
              style={[styles.chip, locked && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
            >
              <Ionicons name="camera-outline" size={22} color="#000" />
            </Pressable>
            <Text style={styles.hint} numberOfLines={2}>{pickerHint(list)}</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  dim: { opacity: 0.35 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E5',
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#000' },
  postBtn: { minWidth: 64, height: 34, borderRadius: 17, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  postBtnOn: { backgroundColor: '#000' },
  postBtnOff: { backgroundColor: '#F0F0F0' },
  postBtnText: { fontSize: 15, fontWeight: '700' },
  postTextOn: { color: '#FFF' },
  postTextOff: { color: '#AAA' },

  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: '#E5E5E5' },
  fill: { height: 3, backgroundColor: '#000' },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  authorName: { fontSize: 16, fontWeight: '700', color: '#000' },
  audience: { fontSize: 12, color: '#999', marginTop: 2 },

  input: { flex: 1, marginTop: 14, padding: 0, fontSize: 18, lineHeight: 26, color: '#000', textAlignVertical: 'top' },

  previews: { flexGrow: 0, marginHorizontal: -20 },
  previewRow: { gap: 10, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 20 },
  previewBox: { borderRadius: 14, backgroundColor: '#F0F0F0' },
  videoBox: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  videoLen: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 4 },
  remove: {
    position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#000', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5', backgroundColor: '#FFF',
  },
  chip: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  hint: { flex: 1, fontSize: 11, color: '#999', textAlign: 'right', marginLeft: 4 },
});
