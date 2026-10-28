import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { macroChips } from '@/lib/recipePicks';

/** Protein, carbs and fat of a recipe as small coloured chips (nothing for a figure the recipe does not have). */
export default function MacroChips({ item, large = false }) {
  const chips = macroChips(item);
  if (!chips.length) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={chips.map((c) => c.spoken).join(', ')}>
      {chips.map((c) => (
        <View key={c.key} style={[styles.chip, large && styles.chipLarge]}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <Text style={[styles.text, large && styles.textLarge]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  chipLarge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  text: { fontSize: 11, fontWeight: '700', color: '#333' },
  textLarge: { fontSize: 13 },
});
