// components/BoardPicker.jsx
//
// Chooses what the leaderboard is ranked by: XP, or distance (this week or
// this month). Shared by the Leaderboard screen and the Leaderboard tab in
// Social. The pick itself lives in the screen (see lib/runLeaderboard.js for
// the board ids).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BOARDS, DEFAULT_BOARD, isDistanceBoard } from '../lib/runLeaderboard';

const PERIODS = BOARDS.filter((b) => b.metric === 'distance');
const FIRST_PERIOD = PERIODS[0].id;

function Pill({ label, active, onPress, testID, small }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, small && styles.pillSmall, active && styles.pillActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      testID={testID}
    >
      <Text style={[styles.text, small && styles.textSmall, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

export default function BoardPicker({ board = DEFAULT_BOARD, onChange, style }) {
  const distance = isDistanceBoard(board);
  return (
    <View style={style}>
      <View style={styles.row} accessibilityRole="tablist">
        <Pill label="XP" active={!distance} onPress={() => onChange('xp')} testID="board-xp" />
        <Pill label="Distance" active={distance} onPress={() => onChange(distance ? board : FIRST_PERIOD)} testID="board-distance" />
      </View>
      {distance && (
        <View style={[styles.row, styles.subRow]} accessibilityRole="tablist">
          {PERIODS.map((p) => (
            <Pill key={p.id} small label={p.label} active={board === p.id} onPress={() => onChange(p.id)} testID={`board-${p.id}`} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  subRow: { marginTop: 8 },
  pill: { backgroundColor: '#F0F0F0', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999 },
  pillSmall: { paddingHorizontal: 14, paddingVertical: 6 },
  pillActive: { backgroundColor: '#000000' },
  text: { fontSize: 14, fontWeight: '700', color: '#555555' },
  textSmall: { fontSize: 12, fontWeight: '600' },
  textActive: { color: '#FFFFFF' },
});
