import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SaveButton from './SaveButton';
import MacroChips from './MacroChips';

/**
 * The one recipe at the top of the tab: the best fit for this person right now, with the reasons. Tapping it opens the recipe; the
 * bookmark saves it and "Add to plan" puts it on the meal plan, neither needing the recipe to be opened first.
 */
export default function HeroPick({ item, eyebrow, saveState = 'idle', onPress, onToggleSave, onPlan }) {
  return (
    <View style={styles.card} testID="hero-pick">
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. Open recipe`} onPress={onPress}>
        <View style={styles.image}>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" /> : <Ionicons name="flame-outline" size={34} color="#CCC" />}
          <View style={styles.shade}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.meta}>{[item.cal, item.time].filter(Boolean).join('  ·  ')}</Text>
          </View>
          {onToggleSave ? <SaveButton id={item.id} name={item.name} state={saveState} onPress={onToggleSave} style={styles.save} /> : null}
        </View>
      </Pressable>
      <View style={styles.body}>
        <MacroChips item={item} large />
        {item.reasons && item.reasons.length ? (
          <View style={styles.reasons}>
            {item.reasons.slice(0, 3).map((r) => (
              <View key={r.kind} style={styles.reasonRow}>
                <Ionicons name="checkmark-circle" size={15} color="#0A7A3B" />
                <Text style={styles.reasonText}>{r.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {onPlan ? (
          <Pressable testID="hero-plan" accessibilityRole="button" accessibilityLabel={`Add ${item.name} to your meal plan`} style={styles.planBtn} onPress={onPlan}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.planText}>Add to plan</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20, marginBottom: 24, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFF',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 }, default: {} }),
  },
  image: { height: 210, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 28, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#FFD84D' },
  title: { fontSize: 19, fontWeight: '800', color: '#FFF', marginTop: 2 },
  meta: { fontSize: 12, fontWeight: '600', color: '#EEE', marginTop: 3 },
  save: { position: 'absolute', top: 10, right: 10 },
  body: { padding: 14, gap: 10 },
  reasons: { gap: 6 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reasonText: { flex: 1, fontSize: 13, color: '#333', lineHeight: 18 },
  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#000', height: 44, borderRadius: 22, marginTop: 2 },
  planText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
