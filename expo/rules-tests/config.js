// The two facts the rules tests and the tests that check their wiring both need. No Firebase code in here, so the normal
// jest run can read it.
const path = require('path');

// The emulator is started for this project (see "test:rules" in package.json). A name starting with "demo-" tells the
// Firebase tools it is not a real project, so nothing is looked up online and no login is needed.
const PROJECT_ID = 'demo-zown-rules';

// The rules the app is deployed with. The tests load this very file; they do not keep a copy.
const RULES_FILE = path.join(__dirname, '..', 'firestore.rules');

module.exports = { PROJECT_ID, RULES_FILE };
