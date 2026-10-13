import { distanceM } from '../lib/gpsFilter';
import {
  RACES, RACE_KINDS, MAX_AREAS, LOCAL_RADIUS_KM, LOCAL_RADIUS_MILES, MIN_SEC_PER_KM, MAX_SEC_PER_KM,
  isRaceKind, currentRace, isRaceOpen, timeLeftLabel, raceEntryId, raceTimeSec, isPlausibleTime,
  areaOf, areasNear, buildRaceEntry, AVATAR_MAX, rankByTime, boardRows,
  formatRaceTime, formatRacePace, raceDistanceText, raceSchedule, raceBlurb,
} from '../lib/virtualRaces';

// Local dates are built from their parts so these tests pass in any time zone.
const local = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
const utc = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));

describe('the two races', () => {
  it('are a Local 5K every week and a Worldwide 10K every month', () => {
    expect(RACES.local).toEqual({ kind: 'local', name: 'Local 5K', distanceKm: 5, cadence: 'weekly' });
    expect(RACES.world).toEqual({ kind: 'world', name: 'Worldwide 10K', distanceKm: 10, cadence: 'monthly' });
    expect(RACE_KINDS).toEqual(['local', 'world']);
  });

  it('knows which words are races', () => {
    expect(isRaceKind('local')).toBe(true);
    expect(isRaceKind('world')).toBe(true);
    expect(['', 'marathon', undefined, null, 5, 'toString', '__proto__', ['local'], { toString: () => 'world' }].map(isRaceKind)).toEqual(Array(9).fill(false));
  });
});

describe('currentRace: the Local 5K', () => {
  const idAt = (date) => currentRace('local', date).id;

  it('is the week, Monday to Sunday, named for its Monday', () => {
    expect(idAt(local(2026, 10, 12, 0, 0, 0))).toBe('local-5k-week-2026-10-12'); // Monday, first moment
    expect(idAt(local(2026, 10, 14, 10))).toBe('local-5k-week-2026-10-12'); // Wednesday
    expect(idAt(local(2026, 10, 18, 23, 59, 59))).toBe('local-5k-week-2026-10-12'); // Sunday, last moment
    expect(idAt(local(2026, 10, 19, 0, 0, 0))).toBe('local-5k-week-2026-10-19'); // the next Monday
  });

  it('carries on across a month and a year', () => {
    expect(idAt(local(2026, 11, 1, 12))).toBe('local-5k-week-2026-10-26'); // a Sunday
    expect(idAt(local(2026, 11, 2, 12))).toBe('local-5k-week-2026-11-02');
    expect(idAt(local(2027, 1, 1, 12))).toBe('local-5k-week-2026-12-28'); // Friday, in the week that started in December
    expect(idAt(local(2026, 3, 4, 12))).toBe('local-5k-week-2026-03-02'); // single digits are padded
  });

  it('starts and ends at midnight on the phone\'s own clock', () => {
    const race = currentRace('local', local(2026, 10, 14, 10));
    expect(race.startsAt).toBe(local(2026, 10, 12).getTime());
    expect(race.endsAt).toBe(local(2026, 10, 19).getTime());
  });

  it('has the details of the race', () => {
    const race = currentRace('local', local(2026, 10, 14, 10));
    expect(race).toMatchObject({ kind: 'local', name: 'Local 5K', distanceKm: 5, cadence: 'weekly' });
  });

  it('takes a time in milliseconds too, and the clock when none is given', () => {
    expect(idAt(local(2026, 10, 14, 10).getTime())).toBe('local-5k-week-2026-10-12');
    jest.useFakeTimers().setSystemTime(local(2026, 10, 20, 9));
    try {
      expect(currentRace('local').id).toBe('local-5k-week-2026-10-19');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('currentRace: the Worldwide 10K', () => {
  const idAt = (date) => currentRace('world', date).id;

  it('is the calendar month in UTC', () => {
    expect(idAt(utc(2026, 10, 1, 0, 0))).toBe('world-10k-month-2026-10');
    expect(idAt(utc(2026, 10, 15, 12))).toBe('world-10k-month-2026-10');
    expect(idAt(utc(2026, 10, 31, 23, 59))).toBe('world-10k-month-2026-10');
    expect(idAt(utc(2026, 11, 1, 0, 0))).toBe('world-10k-month-2026-11');
    expect(idAt(utc(2026, 9, 5))).toBe('world-10k-month-2026-09'); // padded
    expect(idAt(utc(2026, 12, 31, 23, 59))).toBe('world-10k-month-2026-12');
    expect(idAt(utc(2027, 1, 1, 0, 0))).toBe('world-10k-month-2027-01');
  });

  it('starts and ends at the same moment for everyone', () => {
    const race = currentRace('world', utc(2026, 10, 15, 12));
    expect(race.startsAt).toBe(Date.UTC(2026, 9, 1));
    expect(race.endsAt).toBe(Date.UTC(2026, 10, 1));
    expect(currentRace('world', utc(2026, 12, 20)).endsAt).toBe(Date.UTC(2027, 0, 1));
  });

  it('has the details of the race', () => {
    expect(currentRace('world', utc(2026, 10, 15))).toMatchObject({ kind: 'world', name: 'Worldwide 10K', distanceKm: 10, cadence: 'monthly' });
  });

  it('is nothing for a race that does not exist', () => {
    expect(currentRace('marathon', utc(2026, 10, 15))).toBeNull();
    expect(currentRace(undefined)).toBeNull();
  });
});

describe('isRaceOpen', () => {
  const race = { startsAt: 1000, endsAt: 2000 };
  it('is true from the start up to, not including, the end', () => {
    expect(isRaceOpen(race, 1000)).toBe(true);
    expect(isRaceOpen(race, 1999)).toBe(true);
    expect(isRaceOpen(race, 2000)).toBe(false);
    expect(isRaceOpen(race, 999)).toBe(false);
  });
  it('is false with no race, and uses the clock when none is given', () => {
    expect(isRaceOpen(null, 1500)).toBe(false);
    expect(isRaceOpen(undefined)).toBe(false);
    expect(isRaceOpen({ startsAt: Date.now() - 1000, endsAt: Date.now() + 60000 })).toBe(true);
  });
});

describe('timeLeftLabel', () => {
  const H = 3600 * 1000;
  const D = 24 * H;
  it('counts days, then hours, then says less than an hour', () => {
    expect(timeLeftLabel(3 * D + 2 * H, 0)).toBe('3 days left');
    expect(timeLeftLabel(2 * D, 0)).toBe('2 days left');
    expect(timeLeftLabel(D, 0)).toBe('1 day left');
    expect(timeLeftLabel(D - 1, 0)).toBe('23 hours left');
    expect(timeLeftLabel(5 * H + 30 * 60000, 0)).toBe('5 hours left');
    expect(timeLeftLabel(H, 0)).toBe('1 hour left');
    expect(timeLeftLabel(H - 1, 0)).toBe('Less than an hour left');
    expect(timeLeftLabel(1, 0)).toBe('Less than an hour left');
  });
  it('says Ended at and after the end', () => {
    expect(timeLeftLabel(100, 100)).toBe('Ended');
    expect(timeLeftLabel(100, 200)).toBe('Ended');
    expect(timeLeftLabel(NaN, 0)).toBe('Ended');
  });
  it('uses the clock when none is given', () => {
    expect(timeLeftLabel(Date.now() + 2 * D + H)).toBe('2 days left');
  });
});

describe('raceEntryId', () => {
  it('is the race and the person, so a person has one result per race', () => {
    expect(raceEntryId('local-5k-week-2026-10-12', 'u1')).toBe('local-5k-week-2026-10-12_u1');
  });
});

describe('raceTimeSec', () => {
  it('adds up the first kilometres, so a 5K time is the first five splits', () => {
    expect(raceTimeSec([300, 310, 305, 295, 290], 5)).toBe(1500);
  });
  it('ignores the kilometres after the line', () => {
    expect(raceTimeSec([300, 310, 305, 295, 290, 400, 410], 5)).toBe(1500);
    expect(raceTimeSec([300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 999], 10)).toBe(3000);
  });
  it('is null until the distance is done', () => {
    expect(raceTimeSec([300, 310, 305, 295], 5)).toBeNull();
    expect(raceTimeSec([], 5)).toBeNull();
    expect(raceTimeSec([300, 300, 300, 300, 300], 10)).toBeNull();
  });
  it('is null when the splits cannot be trusted', () => {
    expect(raceTimeSec([300, 0, 305, 295, 290], 5)).toBeNull();
    expect(raceTimeSec([300, -4, 305, 295, 290], 5)).toBeNull();
    expect(raceTimeSec([300, NaN, 305, 295, 290], 5)).toBeNull();
    expect(raceTimeSec([300, 'x', 305, 295, 290], 5)).toBeNull();
    expect(raceTimeSec([300, undefined, 305, 295, 290], 5)).toBeNull();
    expect(raceTimeSec('30030030030030', 5)).toBeNull();
    expect(raceTimeSec(null, 5)).toBeNull();
    expect(raceTimeSec(undefined, 5)).toBeNull();
  });
  it('is null for a distance that is not a whole number of kilometres', () => {
    expect(raceTimeSec([300, 300, 300, 300, 300, 300], 5.5)).toBeNull();
    expect(raceTimeSec([300], 0)).toBeNull();
    expect(raceTimeSec([300], -1)).toBeNull();
    expect(raceTimeSec([300], '1')).toBeNull();
  });
  it('works for a single kilometre', () => {
    expect(raceTimeSec([271], 1)).toBe(271);
  });
  it('is whole seconds even when the splits are not', () => {
    expect(raceTimeSec([300.3, 300.3], 2)).toBe(601);
    expect(raceTimeSec([300.2, 300.2], 2)).toBe(600);
  });
});

describe('isPlausibleTime', () => {
  it('accepts the fastest and the slowest pace a run can have, and nothing past them', () => {
    expect(MIN_SEC_PER_KM).toBe(140);
    expect(MAX_SEC_PER_KM).toBe(1800);
    expect(isPlausibleTime(700, 5)).toBe(true);
    expect(isPlausibleTime(699, 5)).toBe(false);
    expect(isPlausibleTime(9000, 5)).toBe(true);
    expect(isPlausibleTime(9001, 5)).toBe(false);
    expect(isPlausibleTime(1400, 10)).toBe(true);
    expect(isPlausibleTime(1399, 10)).toBe(false);
  });
  it('accepts an ordinary run', () => {
    expect(isPlausibleTime(1500, 5)).toBe(true);
    expect(isPlausibleTime(3100, 10)).toBe(true);
  });
  it('is a car\'s time, not a run\'s, when it is far faster', () => {
    expect(isPlausibleTime(300, 5)).toBe(false); // 60 s/km, about 60 km/h
  });
  it('rejects anything that is not whole seconds over a real distance', () => {
    expect(isPlausibleTime(1500.5, 5)).toBe(false);
    expect(isPlausibleTime('1500', 5)).toBe(false);
    expect(isPlausibleTime(NaN, 5)).toBe(false);
    expect(isPlausibleTime(null, 5)).toBe(false);
    expect(isPlausibleTime(1500, 0)).toBe(false);
    expect(isPlausibleTime(1500, -5)).toBe(false);
    expect(isPlausibleTime(1500, NaN)).toBe(false);
    expect(isPlausibleTime(1500, undefined)).toBe(false);
    expect(isPlausibleTime(0, 0)).toBe(false);
    expect(isPlausibleTime(1500, Infinity)).toBe(false);
  });
});

describe('areaOf', () => {
  it('names the map square a point is in', () => {
    expect(areaOf({ latitude: 40.05, longitude: -74.05 })).toBe('1300x1059');
  });
  it('gives the same square to points close together and another to the next square over', () => {
    const a = areaOf({ latitude: 40.01, longitude: -74.09 });
    expect(areaOf({ latitude: 40.09, longitude: -74.01 })).toBe(a);
    expect(areaOf({ latitude: 40.11, longitude: -74.05 })).not.toBe(a);
    expect(areaOf({ latitude: 40.05, longitude: -74.11 })).not.toBe(a);
  });
  it('does not carry the position itself', () => {
    expect(areaOf({ latitude: 40.0512345, longitude: -74.0598765 })).toBe(areaOf({ latitude: 40.05, longitude: -74.05 }));
  });
  it('holds at the corners of the map', () => {
    expect(areaOf({ latitude: -90, longitude: -180 })).toBe('0x0');
    expect(areaOf({ latitude: 90, longitude: 180 })).toBe('1799x0'); // the top row, and 180 is where -180 is
    expect(areaOf({ latitude: 0, longitude: 0 })).toBe('900x1800');
  });
  it('is null for anything that is not a position', () => {
    for (const bad of [null, undefined, {}, 'x', 5, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 },
      { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: NaN }, { latitude: '40', longitude: '-74' },
      { latitude: null, longitude: null }, { latitude: 40 }, { longitude: -74 }, { latitude: -91, longitude: 0 }, { latitude: 0, longitude: -181 }]) {
      expect(areaOf(bad)).toBeNull();
    }
  });
});

describe('areasNear', () => {
  const rowCol = (id) => id.split('x').map(Number);
  const middleOf = (id) => {
    const [row, col] = rowCol(id);
    return { latitude: (row + 0.5) / 10 - 90, longitude: (col + 0.5) / 10 - 180 };
  };
  // Every square in a window round the point whose middle is within the radius, found the slow way.
  const brute = (point, radiusKm, rowWindow = 8, colWindow = 100) => {
    const [row0, col0] = rowCol(areaOf(point));
    const out = [];
    for (let row = Math.max(0, row0 - rowWindow); row <= Math.min(1799, row0 + rowWindow); row += 1) {
      for (let d = -colWindow; d <= colWindow; d += 1) {
        const col = (((col0 + d) % 3600) + 3600) % 3600;
        if (distanceM(point, middleOf(`${row}x${col}`)) <= radiusKm * 1000) out.push(`${row}x${col}`);
      }
    }
    return out;
  };

  it('is about 25 miles', () => {
    expect(LOCAL_RADIUS_MILES).toBe(25);
    expect(LOCAL_RADIUS_KM).toBeCloseTo(40.2336, 3);
  });

  it.each([
    ['New Jersey', { latitude: 40.05, longitude: -74.05 }],
    ['the equator', { latitude: 0.05, longitude: 0.05 }],
    ['the far north', { latitude: 70.12, longitude: 20.33 }],
    ['the Canadian Arctic', { latitude: 72.02, longitude: -100.4 }],
    ['the south', { latitude: -33.87, longitude: 151.21 }],
    ['the date line, east side', { latitude: 10.02, longitude: 179.97 }],
    ['the date line, west side', { latitude: -10.02, longitude: -179.99 }],
  ])('is every square whose middle is within the radius, and no other (%s)', (name, point) => {
    const found = areasNear(point);
    expect(new Set(found).size).toBe(found.length);
    expect([...found].sort()).toEqual([...brute(point, LOCAL_RADIUS_KM, 8, 100)].sort());
  });

  it('starts with the square you are in, then the nearest first', () => {
    const point = { latitude: 40.05, longitude: -74.05 }; // the middle of 1300x1059
    expect(areasNear(point)[0]).toBe('1300x1059');
    const corner = { latitude: 40.0999, longitude: -74.0001 }; // at the edge of 1300x1059, nearer to others' middles than its own
    const found = areasNear(corner);
    expect(found[0]).toBe(areaOf(corner));
    const away = found.slice(1).map((id) => distanceM(corner, middleOf(id)));
    expect([...away].sort((a, b) => a - b)).toEqual(away);
  });

  it('takes any radius', () => {
    const point = { latitude: 40.05, longitude: -74.05 };
    expect(areasNear(point, 15).length).toBeLessThan(areasNear(point, 40).length);
    expect([...areasNear(point, 15)].sort()).toEqual([...brute(point, 15)].sort());
    expect([...areasNear(point, 60)].sort()).toEqual([...brute(point, 60, 10, 120)].sort());
  });

  it('always includes the square you are in, even for a tiny radius', () => {
    expect(areasNear({ latitude: 40.0501, longitude: -74.0999 }, 0.1)).toEqual(['1300x1059']);
  });

  it('is about fifty squares at home in New Jersey', () => {
    const count = areasNear({ latitude: 40.05, longitude: -74.05 }).length;
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(70);
  });

  it('never asks for more than the most squares allowed, and still includes your own', () => {
    expect(MAX_AREAS).toBe(150);
    for (const longitude of [-179.95, -100.01, -3.42, 0.04, 87.77, 123.45, 179.99]) {
      const point = { latitude: 89.97, longitude };
      const found = areasNear(point);
      expect(found.length).toBe(MAX_AREAS);
      expect(new Set(found).size).toBe(MAX_AREAS);
      expect(found).toContain(areaOf(point));
    }
  });

  it('reaches the bottom row of the map, not just the top', () => {
    const found = areasNear({ latitude: -89.97, longitude: 10 });
    expect(found).toHaveLength(MAX_AREAS);
    expect(found.every((id) => id.startsWith('0x'))).toBe(true);
  });

  it('is nothing when the point is not a position', () => {
    expect(areasNear(null)).toEqual([]);
    expect(areasNear({ latitude: 'x', longitude: 1 })).toEqual([]);
  });
});

describe('buildRaceEntry', () => {
  const local5k = { id: 'local-5k-week-2026-10-12', kind: 'local', distanceKm: 5 };
  const world10k = { id: 'world-10k-month-2026-10', kind: 'world', distanceKm: 10 };
  const user = { uid: 'u1', name: 'Cj', profileImage: 'https://img/p.png' };

  it('is the name, picture, time and map square, and nothing about where you were', () => {
    expect(buildRaceEntry({ race: local5k, user, timeSec: 1471, finishedAt: '2026-10-14T10:00:00.000Z', areaId: '1300x1059' })).toEqual({
      raceId: 'local-5k-week-2026-10-12', uid: 'u1', kind: 'local', distanceKm: 5, name: 'Cj', avatar: 'https://img/p.png',
      timeSec: 1471, finishedAt: '2026-10-14T10:00:00.000Z', areaId: '1300x1059',
    });
  });
  it('has no map square on the worldwide race, whatever is passed', () => {
    const entry = buildRaceEntry({ race: world10k, user, timeSec: 3100, finishedAt: 'x', areaId: '1300x1059' });
    expect(entry.areaId).toBeNull();
    expect(entry).toMatchObject({ kind: 'world', distanceKm: 10, raceId: 'world-10k-month-2026-10' });
  });
  it('has a null square for a local result with none', () => {
    expect(buildRaceEntry({ race: local5k, user, timeSec: 1471, finishedAt: 'x' }).areaId).toBeNull();
    expect(buildRaceEntry({ race: local5k, user, timeSec: 1471, finishedAt: 'x', areaId: '' }).areaId).toBeNull();
  });
  it('trims the name, cuts it at 40 letters and falls back to Zown User', () => {
    const name = (n) => buildRaceEntry({ race: world10k, user: { ...user, name: n }, timeSec: 3100, finishedAt: 'x' }).name;
    expect(name('  Cj Wright  ')).toBe('Cj Wright');
    expect(name('a'.repeat(60))).toBe('a'.repeat(40));
    expect(name('   ')).toBe('Zown User');
    expect(name(undefined)).toBe('Zown User');
    expect(name(null)).toBe('Zown User');
  });
  it('only shows a picture that is a web address', () => {
    const avatar = (p) => buildRaceEntry({ race: world10k, user: { uid: 'u1', name: 'A', profileImage: p }, timeSec: 3100, finishedAt: 'x' }).avatar;
    expect(avatar('http://img/p.png')).toBe('http://img/p.png');
    expect(avatar('file:///private/p.png')).toBeNull();
    expect(avatar(undefined)).toBeNull();
    expect(avatar(42)).toBeNull();
    const longest = `https://img/${'a'.repeat(AVATAR_MAX - 'https://img/'.length)}`;
    expect(longest).toHaveLength(AVATAR_MAX);
    expect(avatar(longest)).toBe(longest);
    expect(avatar(`${longest}a`)).toBeNull(); // too long for the board: left off, the time still posts
  });
});

describe('rankByTime', () => {
  const e = (uid, timeSec, finishedAt = '2026-10-14T10:00:00Z') => ({ uid, timeSec, finishedAt, name: uid });

  it('puts the fastest first and numbers them from 1', () => {
    const ranked = rankByTime([e('b', 1600), e('a', 1500), e('c', 1700)]);
    expect(ranked.map((r) => [r.uid, r.rank])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });
  it('gives the same time to whoever finished first, then by name of id, so the order is steady', () => {
    const ranked = rankByTime([e('b', 1500, '2026-10-14T12:00:00Z'), e('a', 1500, '2026-10-14T13:00:00Z'), e('c', 1500, '2026-10-14T12:00:00Z')]);
    expect(ranked.map((r) => r.uid)).toEqual(['b', 'c', 'a']);
  });
  it('falls back to the document id when there is no uid', () => {
    const items = [{ id: 'c', timeSec: 1500 }, { id: 'a', timeSec: 1500 }, { id: 'b', timeSec: 1500 }];
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      expect(rankByTime(order.map((i) => items[i])).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    }
  });
  it('breaks a tie the same way whatever order the board arrived in', () => {
    const items = [e('c', 1500), e('a', 1500), e('b', 1500)];
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      expect(rankByTime(order.map((i) => items[i])).map((r) => r.uid)).toEqual(['a', 'b', 'c']);
    }
  });
  it('treats a missing finish time as the earliest', () => {
    const ranked = rankByTime([e('a', 1500, '2026-10-14T12:00:00Z'), { uid: 'b', timeSec: 1500 }]);
    expect(ranked.map((r) => r.uid)).toEqual(['b', 'a']);
  });
  it('leaves out entries with no real time', () => {
    const ranked = rankByTime([e('a', 1500), e('b', 0), e('c', -3), e('d', NaN), e('f', undefined), e('g', '1400'), null, undefined]);
    expect(ranked.map((r) => r.uid)).toEqual(['a']);
  });
  it('does not change the list it was given', () => {
    const list = [e('b', 1600), e('a', 1500)];
    rankByTime(list);
    expect(list.map((x) => x.uid)).toEqual(['b', 'a']);
    expect(list[0].rank).toBeUndefined();
  });
  it('is an empty board for anything that is not a list', () => {
    expect(rankByTime(null)).toEqual([]);
    expect(rankByTime(undefined)).toEqual([]);
    expect(rankByTime('x')).toEqual([]);
  });
});

describe('boardRows', () => {
  const e = (uid, timeSec) => ({ uid, timeSec, name: uid, finishedAt: 'x' });

  it('ranks the board and marks your own row', () => {
    const rows = boardRows([e('a', 1500), e('me', 1600), e('c', 1700)], e('me', 1600), 'me');
    expect(rows.map((r) => [r.uid, r.rank, r.you])).toEqual([['a', 1, false], ['me', 2, true], ['c', 3, false]]);
  });
  it('shows your result at the end without a rank when the loaded part of the board does not include it', () => {
    const rows = boardRows([e('a', 1500), e('c', 1700)], e('me', 2400), 'me');
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ uid: 'me', timeSec: 2400, rank: null, you: true });
    expect(rows.slice(0, 2).map((r) => r.you)).toEqual([false, false]);
  });
  it('does not show you twice', () => {
    const rows = boardRows([e('a', 1500), e('me', 1600)], e('me', 1600), 'me');
    expect(rows.filter((r) => r.uid === 'me')).toHaveLength(1);
  });
  it('shows just the board when you have no result', () => {
    expect(boardRows([e('a', 1500)], null, 'me').map((r) => r.uid)).toEqual(['a']);
    expect(boardRows([e('a', 1500)], undefined, 'me').map((r) => r.uid)).toEqual(['a']);
  });
  it('ignores a result that is not yours or has no time', () => {
    expect(boardRows([e('a', 1500)], e('someone', 1600), 'me').map((r) => r.uid)).toEqual(['a']);
    expect(boardRows([e('a', 1500)], e('me', NaN), 'me').map((r) => r.uid)).toEqual(['a']);
    expect(boardRows([e('a', 1500)], e('me', 1600), null).map((r) => r.uid)).toEqual(['a']);
    expect(boardRows([e('a', 1500)], e('me', 1600), undefined).map((r) => r.uid)).toEqual(['a']);
  });
  it('does not mistake a result with no uid for yours when nobody is signed in', () => {
    expect(boardRows([e('a', 1500)], { timeSec: 1400, name: 'x' }, undefined).map((r) => r.uid)).toEqual(['a']);
    expect(boardRows([e('a', 1500)], { uid: '', timeSec: 1400 }, '').map((r) => r.uid)).toEqual(['a']);
  });
  it('marks nobody when you are not signed in', () => {
    expect(boardRows([{ uid: undefined, timeSec: 1500 }], null, undefined).map((r) => r.you)).toEqual([false]);
    expect(boardRows([e('a', 1500)], null, null).map((r) => r.you)).toEqual([false]);
  });
});

describe('formatRaceTime', () => {
  it('reads as minutes and seconds, and adds hours past the hour', () => {
    expect(formatRaceTime(0)).toBe('0:00');
    expect(formatRaceTime(59)).toBe('0:59');
    expect(formatRaceTime(61)).toBe('1:01');
    expect(formatRaceTime(1471)).toBe('24:31');
    expect(formatRaceTime(3599)).toBe('59:59');
    expect(formatRaceTime(3600)).toBe('1:00:00');
    expect(formatRaceTime(3725)).toBe('1:02:05');
  });
  it('rounds to whole seconds', () => {
    expect(formatRaceTime(1470.6)).toBe('24:31');
    expect(formatRaceTime(1470.4)).toBe('24:30');
  });
  it('shows -- for anything that is not a time', () => {
    for (const bad of [NaN, -1, undefined, null, 'abc', '1500', Infinity]) expect(formatRaceTime(bad)).toBe('--');
  });
});

describe('formatRacePace', () => {
  it('is the average pace per kilometre or per mile', () => {
    expect(formatRacePace(1500, 5, 'metric')).toBe('5:00/km');
    expect(formatRacePace(1500, 5, 'imperial')).toBe('8:03/mi');
    expect(formatRacePace(3000, 10, undefined)).toBe('5:00/km');
    expect(formatRacePace(1505, 5, 'metric')).toBe('5:01/km');
  });
  it('shows -- when it cannot be worked out', () => {
    expect(formatRacePace(0, 5, 'metric')).toBe('--');
    expect(formatRacePace(NaN, 5, 'metric')).toBe('--');
    expect(formatRacePace(1500, 0, 'metric')).toBe('--');
    expect(formatRacePace(1500, undefined, 'metric')).toBe('--');
  });
});

describe('the words', () => {
  it('shows the distance, with miles beside it for a person who reads miles', () => {
    expect(raceDistanceText(RACES.local, 'metric')).toBe('5K');
    expect(raceDistanceText(RACES.local, 'imperial')).toBe('5K · 3.1 mi');
    expect(raceDistanceText(RACES.world, 'imperial')).toBe('10K · 6.2 mi');
    expect(raceDistanceText(RACES.world, undefined)).toBe('10K');
  });
  it('says how often a race is run and how long is left', () => {
    const D = 24 * 3600 * 1000;
    expect(raceSchedule({ cadence: 'weekly', endsAt: 3 * D + 5 }, 0)).toBe('Weekly · 3 days left');
    expect(raceSchedule({ cadence: 'monthly', endsAt: D }, 0)).toBe('Monthly · 1 day left');
    expect(raceSchedule({ cadence: 'monthly', endsAt: 0 }, 5)).toBe('Monthly · Ended');
    expect(raceSchedule({ cadence: 'weekly', endsAt: Date.now() + 2 * D + 1000 })).toBe('Weekly · 2 days left');
  });
  it('explains each race, with the local radius in the person\'s unit', () => {
    expect(raceBlurb('local', 'imperial')).toBe('Run 5K wherever you like this week. Your time is ranked against runners within about 25 miles of where you start.');
    expect(raceBlurb('local', 'metric')).toBe('Run 5K wherever you like this week. Your time is ranked against runners within about 40 km of where you start.');
    expect(raceBlurb('world', 'metric')).toBe('Run 10K wherever you like this month. Your time is ranked against everyone in Zown.');
  });
});
