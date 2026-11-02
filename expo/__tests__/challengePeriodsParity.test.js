// The challenge periods are used by the app (lib/challengePeriods.js) and by the Cloud Function that creates the challenges
// (functions/src/challengePeriods.js). A deployed function cannot import from the app, so the function has a copy. They have to be
// the same file, or the phone would look for today's challenge under one id while the server made it under another.
const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('the challenge periods in the app and in the functions', () => {
  it('are the same file', () => {
    expect(read('functions/src/challengePeriods.js')).toBe(read('lib/challengePeriods.js'));
  });

  it('use nothing from outside themselves, so the copy can run on its own', () => {
    expect(read('lib/challengePeriods.js')).not.toMatch(/^\s*import\s/m);
    expect(read('lib/challengePeriods.js')).not.toMatch(/\brequire\(/);
  });

  it('give the same answers when loaded from both places', () => {
    const app = require('../lib/challengePeriods');
    const server = require('../functions/src/challengePeriods');
    expect(Object.keys(server).sort()).toEqual(Object.keys(app).sort());
    const now = new Date('2026-11-03T01:00:00.000Z'); // 8 PM Eastern on Nov 2
    ['daily', 'weekly', 'monthly', 'seasonal'].forEach((cadence) => {
      expect(server.getPeriod(cadence, now)).toEqual(app.getPeriod(cadence, now));
      expect(server.challengeDocId(cadence, server.getCurrentPeriodKey(cadence, now))).toBe(app.challengeDocId(cadence, app.getCurrentPeriodKey(cadence, now)));
    });
  });
});

describe('the challenge store', () => {
  it('takes its periods from the shared file, with no cut of its own', () => {
    const store = read('store/challengeStore.js');
    expect(store).toMatch(/from '\.\.\/lib\/challengePeriods'/);
    expect(store).not.toMatch(/getUTC/);
    expect(store).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });

  it('is told the same period the function makes the challenge in', () => {
    const { getCurrentPeriodKey } = require('../lib/challengePeriods');
    expect(getCurrentPeriodKey('daily', new Date('2026-11-03T01:00:00Z'))).toBe('day-2026-11-02');
  });
});

describe('generateChallenges', () => {
  const index = read('functions/src/index.js');

  it('takes its periods from the shared file and writes each challenge under a fixed id, never a random one', () => {
    expect(index).toMatch(/from '\.\/challengePeriods\.js'/);
    expect(index).toMatch(/challengeDocId\(cadence, period\.periodKey\)/);
    expect(index).toMatch(/createChallengesOnce\(/);
    const start = index.indexOf('export const generateChallenges');
    const end = index.indexOf('export const searchCalorieApiFoods');
    const body = index.slice(start, end);
    expect(body).not.toMatch(/collection\('challenges'\)\.doc\(\)/);
    expect(body).not.toMatch(/getUTC/);
    expect(body).not.toMatch(/db\.batch\(\)/);
  });
});
