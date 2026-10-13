// firestore.rules is read as text, because the emulator is not part of the test run. This
// checks the race board rule against the code that writes to it (lib/virtualRaces.js), so
// the two cannot drift apart: the same limits, the same ids, the same fields.
const fs = require('fs');
const path = require('path');
const {
  RACES, MIN_SEC_PER_KM, MAX_SEC_PER_KM, AVATAR_MAX, currentRace, buildRaceEntry, areaOf,
} = require('../lib/virtualRaces');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

// The text of the { ... } block that starts at `header`, braces matched.
function block(src, header) {
  const start = src.indexOf(header);
  if (start === -1) return null;
  const open = src.indexOf('{', start + header.length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

const rule = block(rules, 'match /raceEntries/{entryId}');
const fieldList = (call) => {
  const found = rule.match(new RegExp(`${call}\\(\\[([^\\]]*)\\]\\)`));
  return found ? found[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort() : null;
};
const raceIdPatterns = () => [...rule.matchAll(/d\.raceId\.matches\('([^']+)'\)/g)].map((m) => new RegExp(m[1]));

describe('the rules for the virtual race boards', () => {
  it('has a raceEntries rule', () => {
    expect(rule).toBeTruthy();
  });

  it('lets anyone signed in read, and nobody else', () => {
    expect(rule).toMatch(/allow read: if request\.auth != null;/);
    expect(rule).not.toMatch(/if\s+true/);
  });

  it('lets a person create only their own valid result', () => {
    expect(rule).toMatch(/allow create: if validRaceEntry\(\);/);
    expect(rule).toMatch(/d\.uid == request\.auth\.uid/);
    expect(rule).toMatch(/entryId == d\.raceId \+ '_' \+ request\.auth\.uid/);
  });

  it('lets a result be replaced only by a faster one', () => {
    expect(rule).toMatch(/allow update: if validRaceEntry\(\) && request\.resource\.data\.timeSec < resource\.data\.timeSec;/);
  });

  it('lets a person remove only their own result', () => {
    expect(rule).toMatch(/allow delete: if request\.auth != null && entryId\.matches\('\.\*_' \+ request\.auth\.uid\);/);
  });

  it('allows exactly the fields the app writes', () => {
    const written = Object.keys(buildRaceEntry({
      race: currentRace('local'), user: { uid: 'u1', name: 'A' }, timeSec: 1500, finishedAt: 'x', areaId: 'a',
    })).sort();
    expect(fieldList('hasOnly')).toEqual(written);
    expect(fieldList('hasAll')).toEqual(written);
  });

  it('uses the same limits and distances as the app', () => {
    expect(rule).toContain(`d.timeSec >= d.distanceKm * ${MIN_SEC_PER_KM}`);
    expect(rule).toContain(`d.timeSec <= d.distanceKm * ${MAX_SEC_PER_KM}`);
    expect(rule).toContain(`d.kind == 'local' && d.distanceKm == ${RACES.local.distanceKm}`);
    expect(rule).toContain(`d.kind == 'world' && d.distanceKm == ${RACES.world.distanceKm}`);
    expect(rule).toMatch(/d\.timeSec is int/);
  });

  it('accepts the id of every race the app can make, and no other shape', () => {
    const [localPattern, worldPattern] = raceIdPatterns();
    expect(raceIdPatterns()).toHaveLength(2);
    for (let day = 0; day < 800; day += 3) {
      const at = new Date(2026, 0, 1 + day, 12);
      expect(currentRace('local', at).id).toMatch(localPattern);
      expect(currentRace('world', at).id).toMatch(worldPattern);
    }
    expect('local-5k-week-26-1-1').not.toMatch(localPattern);
    expect('world-10k-month-2026-10').not.toMatch(localPattern);
    expect('local-5k-week-2026-10-12').not.toMatch(worldPattern);
    expect('local-5k-week-2026-10-12/../x').not.toMatch(localPattern);
    expect('xlocal-5k-week-2026-10-12').not.toMatch(localPattern);
  });

  it('gives the local race a map square and the worldwide race none', () => {
    expect(rule).toMatch(/d\.areaId is string && d\.areaId\.size\(\) > 0 && d\.areaId\.size\(\) <= 12/);
    expect(rule).toMatch(/d\.areaId == null/);
    for (const corner of [{ latitude: 90, longitude: 180 }, { latitude: -90, longitude: -180 }, { latitude: 89.99, longitude: 179.99 }]) {
      expect(areaOf(corner).length).toBeLessThanOrEqual(12);
    }
  });

  it('holds the picture and the finish time stamp to what the app writes', () => {
    expect(rule).toContain(`(d.avatar == null || (d.avatar is string && d.avatar.size() <= ${AVATAR_MAX}))`);
    const entry = buildRaceEntry({
      race: currentRace('world'), user: { uid: 'u1', name: 'A', profileImage: `https://img/${'a'.repeat(AVATAR_MAX)}` },
      timeSec: 3100, finishedAt: new Date(2026, 9, 14, 10).toISOString(),
    });
    expect(entry.avatar).toBeNull();
    expect(rule).toMatch(/d\.finishedAt is string && d\.finishedAt\.size\(\) <= 40;/);
    expect(entry.finishedAt.length).toBeLessThanOrEqual(40);
  });

  it('holds the name to the length the app cuts it at', () => {
    expect(rule).toMatch(/d\.name is string && d\.name\.size\(\) > 0 && d\.name\.size\(\) <= 40/);
    const entry = buildRaceEntry({ race: currentRace('world'), user: { uid: 'u1', name: 'x'.repeat(100) }, timeSec: 3100, finishedAt: 'x' });
    expect(entry.name).toHaveLength(40);
  });
});
