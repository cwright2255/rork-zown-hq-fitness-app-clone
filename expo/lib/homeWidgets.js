// lib/homeWidgets.js
//
// Registry of every home-screen widget: id, display label, icon, and
// kind. This is the local "catalog" (matching badgeStore.js's own
// comment about its badge catalog being fixed/local, with only
// unlock-state synced) - homeWidgetsStore.js only syncs which ids are
// enabled and their order, never this definition itself.
//
// kind determines how HomeScreen (app/hq.jsx) renders each widget:
//  - 'card': one of the existing renderExpandableCard() blocks.
//  - 'workoutHistory' / 'runningLog': new widget types with swipeable
//    metric pages and a "View Full Log" button (see components/
//    WorkoutHistoryWidget.jsx and RunningLogWidget.jsx).
//  - 'carousel' / 'banner': existing page sections (Recommended
//    Workouts, Invite banner), wrapped into the same enable/reorder
//    system rather than rebuilt.
export const WIDGET_REGISTRY = [
  { id: 'calories', label: 'Calories', icon: 'flame-outline', kind: 'card' },
  { id: 'heart', label: 'Heart', icon: 'heart-outline', kind: 'card' },
  { id: 'steps', label: 'Steps', icon: 'footsteps-outline', kind: 'card' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', kind: 'card' },
  { id: 'totalXp', label: 'Total XP', icon: 'star-outline', kind: 'card' },
  { id: 'storiesClimbed', label: 'Stories Climbed', icon: 'trending-up-outline', kind: 'card' },
  { id: 'restingHrv', label: 'Resting HRV', icon: 'pulse-outline', kind: 'card' },
  { id: 'hydration', label: 'Hydration', icon: 'water-outline', kind: 'card' },
  { id: 'workoutHistory', label: 'Workout History', icon: 'barbell-outline', kind: 'workoutHistory' },
  { id: 'runningLog', label: 'Running Log', icon: 'walk-outline', kind: 'runningLog' },
  { id: 'recommendedWorkouts', label: 'Recommended Workouts', icon: 'clipboard-outline', kind: 'carousel' },
  { id: 'inviteFriends', label: 'Invite Your Friends', icon: 'person-add-outline', kind: 'banner' },
  // Real fix: now genuinely 'card' kind, matching their rebuilt structure
  // (same size/shape as the other 8 grid widgets, collapsed to one
  // headline value). Originally 'strengthScore'/'fasting' as distinct
  // kinds when these were full-width sections - visually inconsistent
  // with the rest of the grid, per direct feedback after seeing the
  // real, deployed result.
  { id: 'strengthScore', label: 'Strength Score', icon: 'trophy-outline', kind: 'card' },
  { id: 'fasting', label: 'Fasting Timer', icon: 'timer-outline', kind: 'card' },
];

// Default layout for a user who has never customized their home screen -
// every widget enabled, in the registry's own order (matches the current,
// unmodified page exactly, so nothing visually changes until someone
// actually opens edit mode).
export function getDefaultWidgetLayout() {
  return WIDGET_REGISTRY.map((w) => ({ id: w.id, enabled: true }));
}

export function getWidgetDefinition(id) {
  return WIDGET_REGISTRY.find((w) => w.id === id) || null;
}

// Real, new: the full, ordered layout - the user's actually-stored
// layout, plus any registry widget not yet in it (added to the registry
// after this user last saved a custom order) appended at the end, same
// "everything on by default" intent as getDefaultWidgetLayout. Shared
// by app/hq.jsx (to render in the right order) and
// components/WidgetEditorModal.jsx (to list every widget, including
// ones a user has never explicitly seen yet).
export function getFullOrderedLayout(layout) {
  const knownIds = new Set(layout.map((w) => w.id));
  const extras = WIDGET_REGISTRY
    .filter((w) => !knownIds.has(w.id))
    .map((w) => ({ id: w.id, enabled: true }));
  return [...layout, ...extras];
}
