// The Home widget list (lib/homeWidgets.js) and the screen that draws it (app/hq.jsx) have to agree: a widget in the list with
// nothing drawing it would show an empty space in the editor and the grid, and a drawn widget missing from the list could never
// be switched off.
import fs from 'fs';
import path from 'path';
import { WIDGET_REGISTRY, getDefaultWidgetLayout, getFullOrderedLayout, getWidgetDefinition } from '../lib/homeWidgets';

const hq = fs.readFileSync(path.join(__dirname, '../app/hq.jsx'), 'utf8');
const block = hq.slice(hq.indexOf('const widgetRenderers = {'), hq.indexOf('const { gridWidgetIds, sectionWidgetIds }'));
const rendererIds = [...block.matchAll(/^ {4}([A-Za-z]+): \(\) =>/gm)].map((m) => m[1]);
const ids = WIDGET_REGISTRY.map((w) => w.id);

describe('the Home widget list', () => {
  it('has each widget once, with a label and an icon', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(WIDGET_REGISTRY.map((w) => w.label)).size).toBe(ids.length);
    WIDGET_REGISTRY.forEach((w) => {
      expect(typeof w.label).toBe('string');
      expect(w.label.length).toBeGreaterThan(0);
      expect(w.icon).toMatch(/-outline$/);
      expect(['card', 'workoutHistory', 'runningLog', 'carousel', 'banner']).toContain(w.kind);
    });
  });

  it('is drawn by the Home screen, apart from the two it lists that nothing draws yet, and nothing unlisted is drawn', () => {
    expect(rendererIds.length).toBeGreaterThan(0);
    expect(rendererIds.filter((id) => !ids.includes(id))).toEqual([]);
    // Workout History and Running Log are in the list (so in the editor) but the components that were to draw them,
    // WorkoutHistoryWidget and RunningLogWidget, were never written. This pins that, so a new widget cannot be added the same way.
    expect(ids.filter((id) => !rendererIds.includes(id)).sort()).toEqual(['runningLog', 'workoutHistory']);
  });

  it('has the newer widgets, as cards in the grid', () => {
    expect(getWidgetDefinition('streak')).toMatchObject({ label: 'Workout Streak', kind: 'card' });
    expect(getWidgetDefinition('nextUp')).toMatchObject({ label: 'Next Up', kind: 'card' });
    expect(getWidgetDefinition('battlePass')).toMatchObject({ label: 'Battle Pass', kind: 'card' });
    expect(getWidgetDefinition('trainingLoad')).toMatchObject({ label: 'Training Load', kind: 'card' });
    expect(getWidgetDefinition('muscles')).toMatchObject({ label: 'Muscles', kind: 'card' });
  });

  it('adds the newer widgets after the ones before them, in the order they were added', () => {
    expect(ids.slice(15)).toEqual(['streak', 'nextUp', 'battlePass', 'trainingLoad', 'muscles']);
  });

  it('keeps the widgets people already have where they were, before the newer ones', () => {
    // A saved layout stays as it is; this is the order for someone who never changed theirs.
    const order = ids.slice(0, 15);
    expect(order).toEqual([
      'calories', 'heart', 'steps', 'sleep', 'totalXp', 'storiesClimbed', 'restingHrv', 'hydration', 'workoutHistory',
      'runningLog', 'recommendedWorkouts', 'inviteFriends', 'strengthScore', 'fasting', 'music',
    ]);
  });
});

describe('the layout', () => {
  it('starts with every widget on, in the list\'s order', () => {
    expect(getDefaultWidgetLayout()).toEqual(ids.map((id) => ({ id, enabled: true })));
  });

  it('adds a widget a saved layout has never seen at the end, switched on, and leaves the saved order and choices alone', () => {
    const saved = [{ id: 'music', enabled: false }, { id: 'calories', enabled: true }, { id: 'steps', enabled: false }];
    const full = getFullOrderedLayout(saved);
    expect(full.slice(0, 3)).toEqual(saved);
    const added = full.slice(3);
    expect(added.map((w) => w.id).sort()).toEqual(ids.filter((id) => !['music', 'calories', 'steps'].includes(id)).sort());
    expect(added.every((w) => w.enabled)).toBe(true);
    expect(added.map((w) => w.id)).toEqual(ids.filter((id) => !['music', 'calories', 'steps'].includes(id)));
  });

  it('does not add a widget twice', () => {
    const full = getFullOrderedLayout(getDefaultWidgetLayout());
    expect(full).toHaveLength(ids.length);
    expect(getFullOrderedLayout(full)).toEqual(full);
  });
});
