import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { useNutritionStore } from '@/store/nutritionStore';
import { macrosSummary } from '@/lib/macroWeightData';
import { localDateKey } from '@/lib/localDate';

// Home > Macros: today's protein, carbs and fat in grams against the daily goals, each with a small bar. The grams are added up from the
// food diary the way the Nutrition screen adds them (lib/macroWeightData.js), so the two agree. A tap opens Nutrition.
export default function MacrosWidget() {
  const meals = useNutritionStore((s) => s.meals);
  const goals = useNutritionStore((s) => s.dailyGoals);
  const today = localDateKey();

  const summary = useMemo(() => macrosSummary({ meals, goals, dateKey: today }), [meals, goals, today]);

  return (
    <HomeWidgetCard
      testID="home-widget-macros"
      label="Macros"
      icon="nutrition-outline"
      caption={summary.caption}
      accessibilityLabel={`${summary.sentence}. Opens Nutrition.`}
      onPress={() => router.push('/nutrition')}
    >
      <View>
        {summary.rows.map((row) => (
          <View key={row.key} style={s.row} testID={`home-macro-${row.key}`}>
            <View style={s.line}>
              <Text style={s.name} numberOfLines={1}>{row.label}</Text>
              <Text style={s.amount} numberOfLines={1} testID={`home-macro-${row.key}-text`}>{row.text}</Text>
            </View>
            {row.pct !== null && (
              <View style={s.track}>
                <View testID={`home-macro-${row.key}-bar`} style={[s.fill, { width: `${row.pct}%`, backgroundColor: row.color }]} />
              </View>
            )}
          </View>
        ))}
      </View>
    </HomeWidgetCard>
  );
}

const s = StyleSheet.create({
  row: { marginBottom: 5 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 12, fontWeight: '600', color: '#333', flexShrink: 1, marginRight: 6 },
  amount: { fontSize: 12, fontWeight: '700', color: '#000' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#EEEEEE', marginTop: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
