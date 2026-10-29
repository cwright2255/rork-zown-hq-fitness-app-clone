// firestore.indexes.json: the indexes the database needs for the app's queries.
//
// A query that filters on one field and sorts or ranges on another is refused by Firestore unless an index for that pair exists, and
// it fails only on the real database, never in the emulator or in any of these tests. Two were missing: the conversation list
// (participantIds array-contains + updatedAt newest first) and the community stats the coach reads (completed + date range on workouts).
// This holds the file to the queries that need it. It is deployed with `firebase deploy --only firestore:indexes`.
const fs = require('fs');
const path = require('path');

const expoDir = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(expoDir, ...parts), 'utf8');
const file = JSON.parse(read('firestore.indexes.json'));

/** "workouts: userId ASCENDING, date DESCENDING" - how an index is written down here, and how a query's needs are. */
const signature = (collectionGroup, fields) => `${collectionGroup}: ${fields.join(', ')}`;
const sig = (index) => signature(index.collectionGroup, index.fields.map((f) => `${f.fieldPath} ${f.arrayConfig || f.order}`));
const have = file.indexes.map(sig);

// Every query the app makes that needs one of these, and where it is.
const NEEDED = {
  'workouts: userId ASCENDING, date DESCENDING': 'the workout history (src/hooks/useWorkouts.js, store/workoutStore.js)',
  'goals: userId ASCENDING, createdAt DESCENDING': 'goals (src/hooks/useGoals.js, store/goalsStore.js)',
  'aiRecommendations: userId ASCENDING, createdAt DESCENDING': 'the coach\'s recommendations (src/hooks/useAICoach.js)',
  'raceEntries: raceId ASCENDING, timeSec ASCENDING': 'a virtual race\'s board (store/virtualRaceStore.js)',
  'conversations: participantIds CONTAINS, updatedAt DESCENDING': 'the conversation list (store/messagingStore.js subscribeConversations)',
  'workouts: completed ASCENDING, date ASCENDING': 'the community stats (functions/src/index.js, completed workouts of the last 30 days)',
};

describe('firestore.indexes.json', () => {
  it('is the file firebase.json deploys', () => {
    expect(JSON.parse(read('firebase.json')).firestore.indexes).toBe('firestore.indexes.json');
  });

  it('is written so Firestore accepts it: each index names a collection, a scope, and two or more fields with one direction each', () => {
    expect(Array.isArray(file.indexes)).toBe(true);
    for (const index of file.indexes) {
      expect([sig(index), typeof index.collectionGroup]).toEqual([sig(index), 'string']);
      expect(['COLLECTION', 'COLLECTION_GROUP']).toContain(index.queryScope);
      expect(index.fields.length).toBeGreaterThanOrEqual(2);
      for (const f of index.fields) {
        expect(typeof f.fieldPath).toBe('string');
        expect([sig(index), [f.order, f.arrayConfig].filter(Boolean).length]).toEqual([sig(index), 1]);
        if (f.order) expect(['ASCENDING', 'DESCENDING']).toContain(f.order);
        if (f.arrayConfig) expect(f.arrayConfig).toBe('CONTAINS');
      }
    }
  });

  it('has no index twice', () => {
    expect(new Set(have).size).toBe(have.length);
  });

  it.each(Object.entries(NEEDED))('has %s, for %s', (wanted) => {
    expect(have).toContain(wanted);
  });

  it('has no index that no query needs (an unused index costs storage and slows writes): add the query to NEEDED when you add one', () => {
    expect(have.slice().sort()).toEqual(Object.keys(NEEDED).slice().sort());
  });

  it('keeps an array field to array-contains, which needs the CONTAINS kind, not an order', () => {
    const conv = file.indexes.find((i) => i.collectionGroup === 'conversations');
    expect(conv.fields[0]).toEqual({ fieldPath: 'participantIds', arrayConfig: 'CONTAINS' });
    expect(conv.fields[1]).toEqual({ fieldPath: 'updatedAt', order: 'DESCENDING' });
  });
});

describe('the community stats query', () => {
  const source = read('functions', 'src', 'index.js');
  // db.collection('workouts').where('completed', '==', true).where('date', '>=', ...) - across lines.
  const query = /collection\(\s*'workouts'\s*\)\s*\.where\(\s*'completed'\s*,\s*'=='\s*,\s*true\s*\)\s*\.where\(\s*'date'\s*,\s*'>='/;

  it('is still there, so the index it needs is still needed (update NEEDED above if the query changes)', () => {
    expect(source).toMatch(query);
  });

  it('is covered by an index: an equality on completed, then a range on date', () => {
    expect(have).toContain('workouts: completed ASCENDING, date ASCENDING');
    const index = file.indexes.find((i) => sig(i) === 'workouts: completed ASCENDING, date ASCENDING');
    expect(index.queryScope).toBe('COLLECTION'); // a top-level collection, not a group of subcollections
  });
});
