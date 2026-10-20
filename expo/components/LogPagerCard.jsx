import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// The full-width card the Workout History and Running Log widgets share: a title row, pages you swipe between (each a period with
// three numbers), dots showing which page you are on, the latest entry, and a View Full Log button. The words and numbers come from
// lib/logWidgetData.js; this only draws them. The card looks like the carousel card on Home (white, radius 16, padding 16, the same
// shadow), and every page is the same height, so the card does not jump as you swipe.
const { width } = Dimensions.get('window');
const H_PAD = 22; // the side padding of the Home screen (app/hq.jsx)
const CARD_PAD = 16;
export const PAGE_WIDTH = width - H_PAD * 2 - CARD_PAD * 2;

export default function LogPagerCard({ testID, icon, label, pages, latest, empty, emptyText, onOpen, accessibilityLabel }) {
  const [pageIndex, setPageIndex] = useState(0);

  const onScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setPageIndex(Math.max(0, Math.min(pages.length - 1, idx)));
  };

  return (
    <View style={s.card} testID={testID}>
      <View style={s.header}>
        <Text style={s.label} numberOfLines={1}>{label}</Text>
        <Ionicons name={icon} size={20} color="#000" />
      </View>

      {empty ? (
        <Text style={s.emptyText} testID={`${testID}-empty`}>{emptyText}</Text>
      ) : (
        <>
          <View accessible accessibilityLabel={accessibilityLabel}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              style={s.pager}
              testID={`${testID}-pager`}
            >
              {pages.map((page) => (
                <View key={page.key} style={s.page} testID={`${testID}-page-${page.key}`}>
                  <View style={s.pageHeader}>
                    <Text style={s.pageTitle}>{page.title}</Text>
                    {page.right ? <Text style={s.pageRight}>{page.right}</Text> : null}
                  </View>
                  <View style={s.stats}>
                    {page.stats.map((stat) => (
                      <View key={stat.label} style={s.stat}>
                        <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{stat.value}</Text>
                        <Text style={s.statLabel} numberOfLines={1}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={s.dots}>
            {pages.map((page, i) => (
              <View key={page.key} testID={`${testID}-dot-${i}`} style={[s.dot, pageIndex === i && s.dotActive]} />
            ))}
          </View>

          {latest ? <Text style={s.latest} numberOfLines={1} testID={`${testID}-latest`}>{`Latest: ${latest.line}`}</Text> : null}
        </>
      )}

      <TouchableOpacity
        style={s.button}
        activeOpacity={0.8}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`View the full log: ${label}`}
        testID={`${testID}-open`}
      >
        <Text style={s.buttonText}>View Full Log</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: CARD_PAD,
    marginBottom: 12,
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', flexShrink: 1, marginRight: 6 },
  pager: { width: PAGE_WIDTH, flexGrow: 0 },
  page: { width: PAGE_WIDTH, paddingRight: 4 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pageTitle: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase' },
  pageRight: { fontSize: 12, fontWeight: '600', color: '#666' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#000' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E0E0E0' },
  dotActive: { backgroundColor: '#000', width: 16 },
  latest: { fontSize: 12, color: '#666', marginTop: 6 },
  emptyText: { fontSize: 13, color: '#999', marginBottom: 4 },
  button: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
