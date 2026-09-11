import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Check } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useOrderStore } from '@/store/orderStore';
import { tokens } from '../../theme/tokens';



export default function OrderTrackingScreen() {
  const { orders } = useOrderStore();
  const [selected, setSelected] = useState(orders?.[0] || null);

  if (!orders?.length) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Order Tracking" showBack />
        <View style={styles.center}>
          <Text style={styles.empty}>No orders yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Order Tracking" showBack />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {orders.map(o => {
          const active = selected?.id === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => setSelected(o)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}>
              <Text style={[styles.tabText, { color: active ? '#000' : '#999' }]}>
                #{o.id}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        {selected ? (
          <>
            <View style={styles.orderCard}>
              <Text style={styles.orderNum}>Order #{selected.id}</Text>
              <Text style={styles.orderDate}>{selected.orderDate}</Text>
              {selected.total ? (
                <Text style={styles.orderTotal}>Total: ${selected.total}</Text>
              ) : null}
              {selected.status ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{selected.status}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>Timeline</Text>
            <View style={styles.timelineCard}>
              {(selected.trackingEvents || []).map((ev, i) => {
                const isLast = i === selected.trackingEvents.length - 1;
                return (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.dot,
                          ev.completed ? styles.dotDone : styles.dotPending,
                        ]}>
                        {ev.completed ? <Check size={12} color="#FFFFFF" /> : null}
                      </View>
                      {!isLast ? (
                        <View style={[styles.line, ev.completed && styles.lineDone]} />
                      ) : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.stepName}>{ev.name || ev.title}</Text>
                      {ev.description ? (
                        <Text style={styles.stepDesc}>{ev.description}</Text>
                      ) : null}
                      {ev.timestamp ? (
                        <Text style={styles.stepTime}>{ev.timestamp}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. One genuine contrast fix, not a direct swap:
// dotPending's border and line's background both used text_primary
// (white) for their default/pending timeline state, since white was
// visible against the original dark background - invisible against
// this new light one, so both are now a visible light gray (#CCCCCC)
// instead, distinct from the black used for the "done" state.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#999999' },
  tabs: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, maxHeight: 60 },
  tab: { paddingVertical: tokens.spacing.sm, paddingHorizontal: 14, borderRadius: 999, marginRight: 8 },
  tabActive: { backgroundColor: '#000000' },
  tabInactive: { backgroundColor: '#FFFFFF', ...cardShadow },
  tabText: { fontSize: 13, fontWeight: '600' },
  orderCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  orderNum: { color: '#000000', fontSize: 18, fontWeight: '700' },
  orderDate: { color: '#999999', fontSize: 13, marginTop: 4 },
  orderTotal: { color: '#000000', fontSize: 14, marginTop: 8 },
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
  },
  statusText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 14, marginTop: 20,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 30 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#000000' },
  dotPending: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#CCCCCC' },
  line: { flex: 1, width: 2, backgroundColor: '#CCCCCC', marginTop: 2 },
  lineDone: { backgroundColor: '#000000' },
  timelineContent: { flex: 1, paddingBottom: 16, paddingLeft: 8 },
  stepName: { color: '#000000', fontSize: 15, fontWeight: '500' },
  stepDesc: { color: '#999999', fontSize: 13, marginTop: 2 },
  stepTime: { color: '#999999', fontSize: 11, marginTop: 4 },
});
