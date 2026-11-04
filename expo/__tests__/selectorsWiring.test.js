// Home (app/hq.jsx) and the active workout (app/workout/active.jsx) read the stores through selectors, and the active workout draws the
// exercises still to come with a FlatList. The render-count tests (homeRenderCount, activeWorkoutRenderCount) show it working; this one keeps it from sliding back by
// accident, in the two screens and in the music hook the active workout reads through: one `const { x } = useSomeStore();` anywhere in them
// would bring back a redraw on every change in that store.
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/** The code with its comments taken out, so a comment that mentions `useXStore()` is not counted. */
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every `useSomeStore()` call with nothing inside the brackets: the whole store, so any change in it draws the screen again. */
const wholeStoreCalls = (source) => withoutComments(source).match(/\buse[A-Z]\w*Store\(\s*\)/g) || [];

describe('wholeStoreCalls', () => {
  it('finds a store that is read whole, and not one that is read through a selector', () => {
    expect(wholeStoreCalls('const { a } = useWorkoutStore();')).toEqual(['useWorkoutStore()']);
    expect(wholeStoreCalls('const x = useExpStore( );\nconst y = useUserStore();')).toEqual(['useExpStore( )', 'useUserStore()']);
    expect(wholeStoreCalls('const a = useUserStore((s) => s.user);\nconst b = useHealthStore(useShallow((s) => ({ a: s.a })));')).toEqual([]);
  });

  it('does not count a store that is only mentioned in a comment, or its getState()', () => {
    expect(wholeStoreCalls('// was useUserStore();\n/* and useExpStore(); */\nuseWorkoutStore.getState();')).toEqual([]);
  });
});

describe.each([
  ['Home', 'app/hq.jsx'],
  ['the active workout', 'app/workout/active.jsx'],
  ['the music hook the active workout reads through', 'store/useActiveMusicPlayer.js'],
])('%s', (_name, file) => {
  it('reads no store whole', () => {
    expect(wholeStoreCalls(read(file))).toEqual([]);
  });
});

describe('the music hook', () => {
  const hook = read('store/useActiveMusicPlayer.js');

  it('keeps the answer the same object until a value it reads changes', () => {
    expect(hook).toMatch(/from 'zustand\/react\/shallow'/);
    expect(withoutComments(hook).match(/use(Spotify|AppleMusic)Store\(useShallow\(/g)).toHaveLength(2);
  });

  it('boils the current track down to its name, artist and picture inside the selector', () => {
    const code = withoutComments(hook);
    expect(code).toMatch(/trackName: s\.currentTrack\?\.name/);
    expect(code).toMatch(/trackName: s\.currentTrack\?\.title/);
    // The track object itself, which every poll replaces, is not handed on to the screen.
    expect(code).not.toMatch(/\bcurrentTrack: s\.currentTrack\b/);
    expect(code).not.toMatch(/\b(spotify|appleMusic)\.currentTrack\b/);
  });
});

describe('the long list', () => {
  // Home's grid of cards sits side by side and the open card takes the full width and pushes the rest down, which a list laid out in
  // columns cannot do, so Home stays a ScrollView: what was done for it is the selectors above. The one long list of rows is the exercises
  // still to come in the active workout, which grows with the length of the workout.
  it('draws the exercises still to come with a horizontal FlatList', () => {
    const code = withoutComments(read('app/workout/active.jsx'));
    expect(code).toMatch(/<FlatList\s+horizontal\s+data=\{upcomingExercises\}/);
    expect(code).not.toMatch(/upcomingExercises\.map\(/);
  });
});
