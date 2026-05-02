import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useOrderStore } from '@/store/orderStore';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';
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
              <Text style={[styles.tabText, { color: active ? tokens.colors.grayscale.black : tokens.colors.sky.dark }]}>
                #{o.id}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
                        {ev.completed ? <Check size={12} color=tokens.colors.grayscale.black /> : null}
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
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: tokens.colors.sky.dark },
  tabs: { paddingHorizontal: 16, paddingVertical: 8, maxHeight: 60 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, marginRight: 8 },
  tabActive: { backgroundColor: tokens.colors.background.default },
  tabInactive: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface },
  tabText: { fontSize: 13, fontWeight: '600' },
  orderCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, padding: 16,
  },
  orderNum: { color: tokens.colors.background.default, fontSize: 18, fontWeight: '700' },
  orderDate: { color: tokens.colors.sky.dark, fontSize: 13, marginTop: 4 },
  orderTotal: { color: tokens.colors.background.default, fontSize: 14, marginTop: 8 },
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
  },
  statusText: { color: tokens.colors.green.light, fontSize: 12, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.sky.dark, marginBottom: 8, marginTop: 20,
  },
  timelineCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: tokens.colors.legacy.darkSurface,
    borderRadius: 16, padding: 16,
  },
  timelineRow: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 30 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: tokens.colors.background.default },
  dotPending: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tokens.colors.ink.dark },
  line: { flex: 1, width: 2, backgroundColor: tokens.colors.ink.dark, marginTop: 2 },
  lineDone: { backgroundColor: tokens.colors.background.default },
  timelineContent: { flex: 1, paddingBottom: 16, paddingLeft: 8 },
  stepName: { color: tokens.colors.background.default, fontSize: 15, fontWeight: '500' },
  stepDesc: { color: tokens.colors.sky.dark, fontSize: 13, marginTop: 2 },
  stepTime: { color: tokens.colors.ink.light, fontSize: 11, marginTop: 4 },
});
