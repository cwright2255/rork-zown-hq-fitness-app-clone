// components/PostMedia.jsx
//
// Shows the photos or video on a post. Photos sit in a grid and open a
// full-screen swipeable viewer when tapped. A video shows a play tile first
// and only loads the player once tapped, so a long feed does not start
// downloading every video.

import React, { useState } from 'react';
import {
  View, Text, Image, Pressable, Modal, FlatList, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, Audio, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clampAspect, gridRows, formatDuration } from '../lib/postMedia';

async function allowSoundInSilentMode() {
  try {
    // Same settings services/audioPlayerService.js uses, so videos are not muted by the ringer switch.
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
  } catch (e) {
    // Not fatal: the video still plays, it just follows the ringer switch.
  }
}

function VideoTile({ item }) {
  const [active, setActive] = useState(false);
  const aspectRatio = clampAspect(item.width, item.height, 16 / 9);

  if (!active) {
    return (
      <Pressable
        onPress={() => { allowSoundInSilentMode(); setActive(true); }}
        style={[styles.videoTile, { aspectRatio }]}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <View style={styles.playCircle}>
          <Ionicons name="play" size={28} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </View>
        {!!item.durationMs && (
          <View style={styles.durationChip}>
            <Text style={styles.durationText}>{formatDuration(item.durationMs)}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.videoTile, { aspectRatio }]}>
      <Video
        source={{ uri: item.url }}
        style={StyleSheet.absoluteFill}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
      />
    </View>
  );
}

function ImageGrid({ images, onOpen }) {
  if (images.length === 1) {
    const item = images[0];
    return (
      <Pressable onPress={() => onOpen(0)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
        <Image
          source={{ uri: item.url }}
          style={[styles.single, { aspectRatio: clampAspect(item.width, item.height) }]}
          resizeMode="cover"
        />
      </Pressable>
    );
  }
  const rows = gridRows(images.length);
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.gridRow}>
          {row.map((index) => (
            <Pressable
              key={index}
              style={[styles.cell, { aspectRatio: row.length === 1 ? 16 / 9 : 1 }]}
              onPress={() => onOpen(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open photo ${index + 1}`}
            >
              <Image source={{ uri: images[index].url }} style={styles.cellImage} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function Viewer({ images, startIndex, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex || 0);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewerWrap}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex || 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(m, i) => `${m.url}-${i}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri: item.url }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </View>
          )}
        />
        <Pressable
          onPress={onClose}
          style={[styles.viewerClose, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        {images.length > 1 && (
          <Text style={[styles.viewerCount, { top: insets.top + 18 }]}>{index + 1} / {images.length}</Text>
        )}
      </View>
    </Modal>
  );
}

export default function PostMedia({ media, style }) {
  const [viewerIndex, setViewerIndex] = useState(null);
  if (!Array.isArray(media) || media.length === 0) return null;

  if (media[0].type === 'video') {
    return (
      <View style={[styles.wrap, style]}>
        <VideoTile item={media[0]} />
      </View>
    );
  }

  const images = media.filter((m) => m.type === 'image').slice(0, 4);
  if (images.length === 0) return null;
  return (
    <View style={[styles.wrap, style]}>
      <ImageGrid images={images} onOpen={setViewerIndex} />
      {viewerIndex !== null && (
        <Viewer images={images} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  single: { width: '100%' },
  grid: { gap: 2 },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1 },
  cellImage: { width: '100%', height: '100%' },
  videoTile: { width: '100%', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  durationChip: {
    position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  durationText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  viewerWrap: { flex: 1, backgroundColor: '#000000' },
  viewerClose: {
    position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  viewerCount: { position: 'absolute', left: 20, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
