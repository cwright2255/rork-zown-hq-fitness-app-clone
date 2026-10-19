import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// The card the newer Home widgets share: the same size and look as Calories, Heart, Steps and the rest of the grid (the numbers
// below are the ones app/hq.jsx uses for its own cards, which are local to that file), but a tap goes to a screen instead of
// opening the card in place. `value` is the big number, `children` goes under it, `caption` is the small line at the bottom.
const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 22;
const CARD_W = (width - H_PAD * 2 - CARD_GAP) / 2;

export default function HomeWidgetCard({ label, icon, value, caption, children, onPress, accessibilityLabel, testID }) {
  return (
    <View style={s.cardContainer}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={s.statCard}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <View style={s.inner}>
          <View style={s.statCardHeader}>
            <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
            <Ionicons name={icon} size={20} color="#000" />
          </View>
          {value !== undefined && value !== null && <Text style={s.statValue} numberOfLines={1}>{value}</Text>}
          {children}
          <View style={s.footer}>
            <Text style={s.statUnit} numberOfLines={1}>{caption}</Text>
            <Ionicons name="chevron-forward" size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  statCard: {
    padding: 16,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  inner: { flex: 1, justifyContent: 'space-between' },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: { fontSize: 14, fontWeight: '600', color: '#333', flexShrink: 1, marginRight: 6 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#000' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  statUnit: { fontSize: 12, color: '#999', marginTop: 2, flexShrink: 1 },
});
