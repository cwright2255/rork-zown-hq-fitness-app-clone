// The XP rules are used by the app (lib/xpRules.js) and by the Cloud Function that keeps the real record
// (functions/src/xpRules.js). A deployed function cannot import from the app, so the function has a copy. They have to be the
// same file, or the phone would show XP the server does not give.
const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('the XP rules in the app and in the function', () => {
  it('are the same file', () => {
    expect(read('functions/src/xpRules.js')).toBe(read('lib/xpRules.js'));
  });

  it('use nothing from outside themselves, so the copy can run on its own', () => {
    expect(read('lib/xpRules.js')).not.toMatch(/^\s*import\s/m);
    expect(read('lib/xpRules.js')).not.toMatch(/\brequire\(/);
  });

  it('give the same answers when loaded from both places', () => {
    const app = require('../lib/xpRules');
    const server = require('../functions/src/xpRules');
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
    const claim = { kind: 'run', day: '2026-10-19', activity: 'run', distanceKm: 6.3, durationSec: 2000 };
    const now = Date.UTC(2026, 9, 19, 12);
    expect(server.applyClaim({ ledger: null, id: 'a', claim, now })).toEqual(app.applyClaim({ ledger: null, id: 'a', claim, now }));
  });
});
