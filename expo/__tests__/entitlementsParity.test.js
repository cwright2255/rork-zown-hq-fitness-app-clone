// The plans are used by the app (lib/entitlements.js) and by the Cloud Functions that enforce them (functions/src/entitlements.js).
// A deployed function cannot import from the app, so the function has a copy. They have to be the same file, or the phone would
// offer something the server refuses, or the server would allow something the phone says needs an upgrade.
const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('the plans in the app and in the functions', () => {
  it('are the same file', () => {
    expect(read('functions/src/entitlements.js')).toBe(read('lib/entitlements.js'));
  });

  it('use nothing from outside themselves, so the copy can run on its own', () => {
    expect(read('lib/entitlements.js')).not.toMatch(/^\s*import\s/m);
    expect(read('lib/entitlements.js')).not.toMatch(/\brequire\(/);
  });

  it('give the same answers when loaded from both places', () => {
    const app = require('../lib/entitlements');
    const server = require('../functions/src/entitlements');
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
    const doc = { tier: 'legend', status: 'cancelled', expiresAt: '2026-12-01T00:00:00.000Z' };
    const now = new Date('2026-10-20T12:00:00.000Z');
    expect(server.effectiveTier(doc, now)).toBe(app.effectiveTier(doc, now));
    expect(server.dailyLimit('pro', 'assist')).toBe(app.dailyLimit('pro', 'assist'));
    expect(server.canUseFeature('pro', 'bodyScan')).toBe(app.canUseFeature('pro', 'bodyScan'));
    expect(server.aiDayKey(now)).toBe(app.aiDayKey(now));
  });
});
