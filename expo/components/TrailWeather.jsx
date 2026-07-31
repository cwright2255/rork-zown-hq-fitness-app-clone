// components/TrailWeather.jsx
//
// Pre-hike risk check on the trail preview page — real forecast plus any
// real, currently-active NWS severe weather alerts for that exact
// trailhead coordinate. This is the "avoid unforeseen risk" moment that
// matters most: before committing to the drive/walk out there, not after.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getWeatherSnapshot } from '@/services/weatherService';

const SEVERITY_COLOR = {
  Extreme: '#B91C1C',
  Severe: '#EA580C',
  Moderate: '#D97706',
  Minor: '#65A30D',
  Unknown: colors.textSecondary,
};

export default function TrailWeather({ latitude, longitude }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getWeatherSnapshot(latitude, longitude).then((result) => {
      if (!cancelled) {
        setSnapshot(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [latitude, longitude]);

  if (loading) {
    return (
      <View style={[styles.card, styles.centerContent]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  }

  // No data at all (non-US coordinate, or the request failed) — this
  // section just doesn't render, same "fail silent, don't show a broken
  // state for an optional-but-important enhancement" pattern used for the
  // route/elevation features on this same screen.
  if (!snapshot || (!snapshot.forecast && snapshot.alerts.length === 0)) return null;

  const current = snapshot.forecast?.[0];
  const hasAlerts = snapshot.alerts.length > 0;

  return (
    <View style={styles.wrap}>
      {hasAlerts && (
        <View style={[styles.alertBanner, { backgroundColor: SEVERITY_COLOR[snapshot.alerts[0].severity] }]}>
          <Ionicons name="warning" size={18} color="#FFF" />
          <View style={{ flex: 1, marginLeft: spacing.xs }}>
            <Text style={styles.alertEvent}>{snapshot.alerts[0].event}</Text>
            <Text style={styles.alertHeadline} numberOfLines={2}>{snapshot.alerts[0].headline}</Text>
          </View>
        </View>
      )}

      {snapshot.alerts.length > 1 && (
        <Text style={styles.moreAlertsText}>
          +{snapshot.alerts.length - 1} more active alert{snapshot.alerts.length > 2 ? 's' : ''} for this area
        </Text>
      )}

      {current && (
        <View style={styles.forecastCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.forecastLabel}>{current.name}</Text>
            <Text style={styles.forecastText} numberOfLines={2}>{current.shortForecast}</Text>
            {current.precipitationChance != null && current.precipitationChance > 0 && (
              <Text style={styles.forecastSub}>
                <Ionicons name="rainy-outline" size={12} /> {current.precipitationChance}% chance of precipitation
              </Text>
            )}
            <Text style={styles.forecastSub}>{current.windDirection} {current.windSpeed}</Text>
          </View>
          <Text style={styles.tempText}>{current.temperatureF}°F</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  card: { borderRadius: radius.md, backgroundColor: colors.card, padding: spacing.md, minHeight: 60 },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  alertEvent: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  alertHeadline: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 },
  moreAlertsText: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  forecastCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, padding: spacing.sm,
  },
  forecastLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  forecastText: { ...typography.bodySmall, color: colors.text, marginTop: 2 },
  forecastSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tempText: { fontSize: 24, fontWeight: '700', color: colors.text, marginLeft: spacing.sm },
});
