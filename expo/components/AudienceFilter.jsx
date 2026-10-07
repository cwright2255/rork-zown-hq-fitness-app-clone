// components/AudienceFilter.jsx
//
// Everyone / Following / Close Friends pills, shared by the Leaderboard,
// Challenges and Duels screens (store/socialGraphStore.js remembers the pick
// per screen).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AUDIENCES } from '../lib/audience';

export default function AudienceFilter({ value, onChange, style }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {AUDIENCES.map((a) => {
        const active = value === a.id;
        return (
          <Pressable
            key={a.id}
            onPress={() => onChange(a.id)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {a.id === 'close' && (
              <Ionicons name="star" size={12} color={active ? '#FFFFFF' : '#16A34A'} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.text, active && styles.textActive]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F0F0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  pillActive: { backgroundColor: '#000000' },
  text: { fontSize: 13, fontWeight: '600', color: '#555555' },
  textActive: { color: '#FFFFFF' },
});
