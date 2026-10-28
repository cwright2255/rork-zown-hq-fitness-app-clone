import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SaveButton from './SaveButton';
import MacroChips from './MacroChips';

export const CARD_WIDTH = 168;

/**
 * One recipe from the Recipes tab: photo, time, name, calories, protein / carbs / fat, why it was picked, and a bookmark that saves
 * it without opening it. `lines` is { uses, needs } for an ingredient search (lib/recipeBrowse.js kitchenLine).
 */
export default function RecipeCard({ item, saveState = 'idle', onPress, onToggleSave, lines, width = CARD_WIDTH, style }) {
  const imageHeight = Math.round(width * 0.72);
  return (
    <Pressable testID={`recipe-card-${item.id}`} accessibilityRole="button" accessibilityLabel={item.name} style={[styles.card, { width }, style]} onPress={onPress}>
      <View style={[styles.image, { width, height: imageHeight }]}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" /> : <Ionicons name="restaurant-outline" size={26} color="#CCC" />}
        {item.time ? (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={11} color="#FFF" />
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        ) : null}
        {onToggleSave ? <SaveButton id={item.id} name={item.name} state={saveState} onPress={onToggleSave} style={styles.save} /> : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      {item.cal ? <Text style={styles.cal}>{item.cal}</Text> : null}
      <MacroChips item={item} />
      {item.reason ? <Text testID={`reason-${item.id}`} style={styles.reason} numberOfLines={2}>{item.reason}</Text> : null}
      {lines && lines.uses ? <Text style={styles.uses}>{lines.uses}</Text> : null}
      {lines && lines.needs ? <Text style={styles.needs} numberOfLines={2}>{lines.needs}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginRight: 12, marginBottom: 16 },
  image: { borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  save: { position: 'absolute', top: 8, right: 8 },
  timePill: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  timeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  name: { fontSize: 14, fontWeight: '700', color: '#000', marginTop: 8 },
  cal: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 2, marginBottom: 6 },
  reason: { fontSize: 11, color: '#555', lineHeight: 15, marginTop: 6 },
  uses: { fontSize: 12, fontWeight: '700', color: '#0A7A3B', marginTop: 6 },
  needs: { fontSize: 11, color: '#777', marginTop: 2, lineHeight: 15 },
});
