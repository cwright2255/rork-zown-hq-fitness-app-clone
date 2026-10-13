// components/RaceTile.jsx
//
// The card for a virtual race or journey, built like a Running Programs card
// (app/running/program/index.jsx): a rounded picture block with an icon, then the
// name and a line under it. A small label sits on the block ("Joined", "Your time
// 24:31", "42%") and, once someone has started a journey, a bar along its foot.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * @param icon        Ionicons name for the picture block
 * @param title       the name
 * @param subtitle    the line under it
 * @param label       short text on the block, or '' for none
 * @param progress    0 to 1 for the bar along the foot of the block, or null for no bar
 * @param width       width of the card
 * @param accessibilityLabel read out by a screen reader
 * @param testID      the card; the label is `${testID}-label` (or labelTestID) and the bar `${testID}-fill`
 * @param labelTestID testID for the label, when it should not be `${testID}-label`
 */
export default function RaceTile({
  icon, title, subtitle, label = '', progress = null, width = 160, onPress, accessibilityLabel, testID, labelTestID,
}) {
  return (
    <Pressable
      style={[styles.tile, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={styles.image}>
        <Ionicons name={icon} size={28} color="#999" />
        {label !== '' && (
          <View style={styles.label}>
            <Text style={styles.labelText} numberOfLines={1} testID={labelTestID || `${testID}-label`}>{label}</Text>
          </View>
        )}
        {progress !== null && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]} testID={`${testID}-fill`} />
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { marginRight: 14 },
  image: {
    height: 100,
    borderRadius: 14,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '90%',
    backgroundColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(0,0,0,0.12)' },
  fill: { height: '100%', backgroundColor: '#22C55E' },
  title: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 8 },
  subtitle: { fontSize: 12, color: '#999', marginTop: 2 },
});
