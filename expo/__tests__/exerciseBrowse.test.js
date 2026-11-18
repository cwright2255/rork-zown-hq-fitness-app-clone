// What the Browse Exercises row shows (lib/exerciseBrowse.js), and the Recent list that is kept for it (store/recentExercisesStore.js).
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import {
  RECENT_EXERCISES_KEPT, BROWSE_DEFAULT_COUNT, BROWSE_FILTERED_COUNT,
  summarizeExercise, addToRecent, bodyPartChoices, exercisesToShow,
} from '../lib/exerciseBrowse';
import { useRecentExercisesStore } from '../store/recentExercisesStore';

// The library as the phone holds it: 60 exercises, in a fixed order, each with a body part (the API writes them in capitals).
const PARTS = ['WAIST', 'CHEST', 'BACK', 'UPPER LEGS'];
const ex = (n, over = {}) => ({
  exerciseId: `e${n}`, name: `Move ${String(n).padStart(2, '0')}`, gifUrl: `https://img/${n}.gif`,
  bodyParts: [PARTS[n % PARTS.length]], equipments: ['BODY WEIGHT'], targetMuscles: ['ABS'], ...over,
});
const LIBRARY = Array.from({ length: 60 }, (_, i) => ex(i));
const names = (items) => items.map((e) => e.name);

describe('summarizeExercise', () => {
  it('keeps what a card and a filter need, and nothing else', () => {
    expect(summarizeExercise({ ...ex(1), instructions: ['a', 'b'], overview: 'long text' })).toEqual({
      exerciseId: 'e1', name: 'Move 01', gifUrl: 'https://img/1.gif', bodyParts: ['CHEST'], equipments: ['BODY WEIGHT'], targetMuscles: ['ABS'],
    });
  });

  it('copes with fields that are missing or the wrong kind', () => {
    expect(summarizeExercise({ exerciseId: 7, name: 'Plank', bodyParts: 'waist', equipments: [1, null, 'band'] })).toEqual({
      exerciseId: '7', name: 'Plank', gifUrl: '', bodyParts: [], equipments: ['band'], targetMuscles: [],
    });
  });

  it('is nothing for something that is not an exercise', () => {
    expect(summarizeExercise(null)).toBeNull();
    expect(summarizeExercise({})).toBeNull();
    expect(summarizeExercise({ name: 'No id' })).toBeNull();
    expect(summarizeExercise({ exerciseId: 'x' })).toBeNull();
    expect(summarizeExercise({ exerciseId: 'x', name: '' })).toBeNull();
  });
});

describe('addToRecent', () => {
  it('puts the exercise first', () => {
    const list = addToRecent(addToRecent([], ex(1)), ex(2));
    expect(names(list)).toEqual(['Move 02', 'Move 01']);
  });

  it('moves one that is opened again to the front instead of listing it twice', () => {
    let list = [];
    [1, 2, 3, 1].forEach((n) => { list = addToRecent(list, ex(n)); });
    expect(names(list)).toEqual(['Move 01', 'Move 03', 'Move 02']);
  });

  it(`keeps the newest ${RECENT_EXERCISES_KEPT} and lets the oldest go`, () => {
    let list = [];
    for (let n = 0; n < 20; n += 1) list = addToRecent(list, ex(n));
    expect(list).toHaveLength(RECENT_EXERCISES_KEPT);
    expect(list[0].name).toBe('Move 19');
    expect(list[RECENT_EXERCISES_KEPT - 1].name).toBe('Move 08');
  });

  it('does not change the list it is given, and gives the same list back for something that is not an exercise', () => {
    const before = [summarizeExercise(ex(1))];
    const copy = JSON.parse(JSON.stringify(before));
    addToRecent(before, ex(2));
    expect(before).toEqual(copy);
    expect(addToRecent(before, null)).toBe(before);
    expect(addToRecent(undefined, ex(1))).toHaveLength(1);
  });
});

describe('bodyPartChoices', () => {
  it('offers the body parts the phone holds, the most common first, written as a person would read them', () => {
    const choices = bodyPartChoices([ex(0), ex(4), ex(8), ex(1), ex(5), ex(2)]); // 3 waist, 2 chest, 1 back
    expect(choices).toEqual([
      { value: 'waist', label: 'Waist' }, { value: 'chest', label: 'Chest' }, { value: 'back', label: 'Back' },
    ]);
    expect(bodyPartChoices(LIBRARY).map((c) => c.label)).toContain('Upper Legs');
  });

  it('counts WAIST and waist as one, and puts ties in alphabetical order', () => {
    const choices = bodyPartChoices([{ bodyParts: ['WAIST'] }, { bodyParts: ['waist'] }, { bodyParts: ['Back'] }, { bodyParts: ['neck'] }]);
    expect(choices.map((c) => c.value)).toEqual(['waist', 'back', 'neck']);
  });

  it('offers no more than asked for, and none for junk', () => {
    expect(bodyPartChoices(LIBRARY, 2)).toHaveLength(2);
    expect(bodyPartChoices([{ bodyParts: [null, '', '  ', 5] }, { bodyParts: 'x' }, null, {}])).toEqual([]);
    expect(bodyPartChoices(null)).toEqual([]);
  });
});

describe('exercisesToShow', () => {
  it('is the first ten, as the row always was, with nothing typed and nothing chosen', () => {
    const shown = exercisesToShow({ exercises: LIBRARY, recent: [] });
    expect(shown.items).toHaveLength(BROWSE_DEFAULT_COUNT);
    expect(names(shown.items)).toEqual(names(LIBRARY.slice(0, 10)));
    expect(shown.filtering).toBe(false);
  });

  it('finds what was typed, by name, in any case, and sees past the first ten', () => {
    const shown = exercisesToShow({ exercises: LIBRARY, recent: [], query: 'move 45' });
    expect(names(shown.items)).toEqual(['Move 45']);
    expect(shown.filtering).toBe(true);
    expect(names(exercisesToShow({ exercises: LIBRARY, recent: [], query: 'MOVE 5' }).items)).toContain('Move 55');
  });

  it('treats spaces alone as nothing typed', () => {
    expect(exercisesToShow({ exercises: LIBRARY, recent: [], query: '   ' }).filtering).toBe(false);
  });

  it('shows one body part, whatever case the library wrote it in', () => {
    const shown = exercisesToShow({ exercises: LIBRARY, recent: [], choice: 'bp:chest' });
    expect(shown.filtering).toBe(true);
    expect(shown.total).toBe(15);
    expect(shown.items.every((e) => e.bodyParts[0] === 'CHEST')).toBe(true);
  });

  it(`holds up to ${BROWSE_FILTERED_COUNT} cards when filtering, and says how many matched`, () => {
    const shown = exercisesToShow({ exercises: LIBRARY, recent: [], query: 'move' });
    expect(shown.items).toHaveLength(BROWSE_FILTERED_COUNT);
    expect(shown.total).toBe(60);
  });

  it('puts a body part and a search together', () => {
    const shown = exercisesToShow({ exercises: LIBRARY, recent: [], query: 'move 1', choice: 'bp:waist' });
    expect(names(shown.items)).toEqual(['Move 12', 'Move 16']);
  });

  it('shows what was opened lately, newest first, even when it is not in the library the phone holds', () => {
    const recent = addToRecent(addToRecent([], ex(1)), { exerciseId: 'far', name: 'Far Away Lift', bodyParts: ['BACK'] });
    const shown = exercisesToShow({ exercises: LIBRARY.slice(0, 5), recent, choice: 'recent' });
    expect(names(shown.items)).toEqual(['Far Away Lift', 'Move 01']);
  });

  it('searches inside Recent, not the whole library', () => {
    const recent = addToRecent(addToRecent([], ex(1)), ex(2));
    expect(names(exercisesToShow({ exercises: LIBRARY, recent, choice: 'recent', query: 'move 02' }).items)).toEqual(['Move 02']);
    expect(exercisesToShow({ exercises: LIBRARY, recent, choice: 'recent', query: 'move 30' }).items).toEqual([]);
  });

  it('is empty, not an error, when nothing matches or nothing is held', () => {
    expect(exercisesToShow({ exercises: LIBRARY, recent: [], query: 'zzz' })).toEqual({ items: [], total: 0, filtering: true });
    expect(exercisesToShow({ exercises: [], recent: [] }).items).toEqual([]);
    expect(exercisesToShow({ exercises: undefined, recent: undefined, choice: 'recent' }).items).toEqual([]);
  });
});

describe('the Recent store', () => {
  beforeEach(() => useRecentExercisesStore.setState({ recent: [] }));

  it('starts empty and puts an opened exercise first', () => {
    expect(useRecentExercisesStore.getState().recent).toEqual([]);
    useRecentExercisesStore.getState().addRecent(ex(1));
    useRecentExercisesStore.getState().addRecent(ex(2));
    expect(names(useRecentExercisesStore.getState().recent)).toEqual(['Move 02', 'Move 01']);
  });

  it('keeps an exercise once, and ignores something that is not one without changing its state', () => {
    useRecentExercisesStore.getState().addRecent(ex(1));
    const before = useRecentExercisesStore.getState();
    useRecentExercisesStore.getState().addRecent(null);
    useRecentExercisesStore.getState().addRecent({ name: 'no id' });
    expect(useRecentExercisesStore.getState()).toBe(before);
    useRecentExercisesStore.getState().addRecent(ex(1));
    expect(useRecentExercisesStore.getState().recent).toHaveLength(1);
  });

  it('saves only the list, under the name Log Out removes', () => {
    expect(useRecentExercisesStore.persist.getOptions().name).toBe('zown-recent-exercises');
    expect(useRecentExercisesStore.persist.getOptions().partialize(useRecentExercisesStore.getState())).toEqual({ recent: [] });
  });
});
