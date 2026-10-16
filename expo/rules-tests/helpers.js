// Set-up shared by the Firestore rules tests in this folder.
//
// These tests load the real expo/firestore.rules into the Firestore emulator, then try reads and writes as different people
// (alice, bob, a visitor who is not signed in, an admin) and check who is let in and who is turned away. Start them with
//
//   npm run test:rules
//
// That starts the emulator, runs every file here against it and stops it again. It needs Java and the Firebase CLI
// (npm install -g firebase-tools). The "Tests" workflow on GitHub runs the same command. Plain `npx jest` does not run
// these files and cannot: there would be no emulator to talk to.
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { PROJECT_ID, RULES_FILE } = require('./config');

/**
 * Call once at the top of a test file. Loads the rules before the tests, empties the database between them, and returns:
 *   as(uid, claims?)  a database handle for that signed-in person
 *   anon()            a database handle for a visitor who is not signed in
 *   seed(docs)        puts documents in without any rules in the way: { 'users/alice': { ... }, ... }
 */
function rulesEnv() {
  let testEnv;
  const handles = new Map();

  beforeAll(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('The Firestore emulator is not running. Run these tests with `npm run test:rules`, which starts it, not with plain jest.');
    }
    // A refused request is what most of these tests expect; the library would print each one as an error.
    try { require('firebase/firestore').setLogLevel('silent'); } catch { /* only quiets the output */ }
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: fs.readFileSync(RULES_FILE, 'utf8') },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    handles.clear();
    if (testEnv) await testEnv.cleanup();
  });

  const handle = (key, make) => {
    if (!handles.has(key)) handles.set(key, make().firestore());
    return handles.get(key);
  };

  return {
    as: (uid, claims) => handle(`${uid}|${JSON.stringify(claims || {})}`, () => testEnv.authenticatedContext(uid, claims)),
    anon: () => handle('anon', () => testEnv.unauthenticatedContext()),
    seed: (docs) => testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const [docPath, data] of Object.entries(docs)) await db.doc(docPath).set(data);
    }),
  };
}

// Short names, so a line reads "ok(...)" = this must be allowed, "no(...)" = this must be refused.
module.exports = { rulesEnv, ok: assertSucceeds, no: assertFails };
