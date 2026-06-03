import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useOrderStore } from '@/store/orderStore';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

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

      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 40 }}>
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
                        {ev.completed ? <Check size={12} color={tokens.colors.dark_navy.text_primary} /> : null}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: tokens.colors.dark_navy.text_muted },
  tabs: { paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, maxHeight: 60 },
  tab: { paddingVertical: tokens.spacing.sm, paddingHorizontal: 14, borderRadius: 999, marginRight: 8 },
  tabActive: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  tabInactive: { backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border },
  tabText: { fontSize: 13, fontWeight: '600' },
  orderCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  orderNum: { color: tokens.colors.dark_navy.bg_primary, fontSize: 18, fontWeight: '700' },
  orderDate: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 4 },
  orderTotal: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, marginTop: 8 },
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
  },
  statusText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: tokens.spacing.sm, marginTop: 20,
  },
  timelineCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
  },
  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 30 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  dotPending: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tokens.colors.dark_navy.text_primary },
  line: { flex: 1, width: 2, backgroundColor: tokens.colors.dark_navy.text_primary, marginTop: 2 },
  lineDone: { backgroundColor: tokens.colors.dark_navy.bg_primary },
  timelineContent: { flex: 1, paddingBottom: 16, paddingLeft: 8 },
  stepName: { color: tokens.colors.dark_navy.bg_primary, fontSize: 15, fontWeight: '500' },
  stepDesc: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, marginTop: 2 },
  stepTime: { color: tokens.colors.dark_navy.text_secondary, fontSize: 11, marginTop: 4 },
});
