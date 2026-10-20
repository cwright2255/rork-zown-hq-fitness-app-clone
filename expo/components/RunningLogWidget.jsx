import React from 'react';
import { router } from 'expo-router';
import LogPagerCard from './LogPagerCard';
import { useRunningStore } from '@/store/runningStore';
import { useSettingsStore } from '@/store/settingsStore';
import { runningLogSummary } from '@/lib/logWidgetData';

// Home > Running Log: distance, time and average pace for the last 7 days, this month and everything logged (swipe between them), the
// latest run or walk, and a View Full Log button that opens the Running Log. Distances and pace follow Settings > Distance Units.
export default function RunningLogWidget() {
  const runs = useRunningStore((s) => s.runs);
  const units = useSettingsStore((s) => s.units);
  const summary = runningLogSummary({ runs, units });
  return (
    <LogPagerCard
      testID="home-widget-runninglog"
      icon="walk-outline"
      label="Running Log"
      pages={summary.pages}
      latest={summary.latest}
      empty={summary.empty}
      emptyText="No runs yet. Record one and it shows up here."
      accessibilityLabel={summary.sentence}
      onOpen={() => router.push('/profile/running-log')}
    />
  );
}
