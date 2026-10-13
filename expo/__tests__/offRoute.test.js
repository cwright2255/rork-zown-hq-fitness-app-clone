import {
  OFF_ROUTE_M, BACK_ON_ROUTE_M, OFF_ROUTE_AFTER_MS, REMIND_EVERY_MS, MAX_ACCURACY_SLACK_M, MAX_READING_GAP_MS,
  distanceToRouteM, createOffRoute, stepOffRoute, roundedDistance, distanceLabel, distanceWords, describeOffRoute,
} from '../lib/offRoute';

const T0 = 1_700_000_000_000;
// A place `x` metres east and `y` metres north of the start of the test trail.
const M_LAT = 111195;
const M_LNG = 84300; // at 40.7 north
const pt = (x, y = 0) => ({ latitude: 40.7 + y / M_LAT, longitude: -74 + x / M_LNG });
// The trail: 1 km due east.
const LINE = [pt(0), pt(500), pt(1000)];

// Feeds a list of { sec, x, y, acc } to the trail one by one and gathers the events.
function walk(steps, { state = createOffRoute(), route = LINE } = {}) {
  let s = state;
  const events = [];
  const distances = [];
  steps.forEach((st) => {
    const r = stepOffRoute(s, { position: pt(st.x, st.y || 0), route, t: T0 + st.sec * 1000, accuracy: st.acc });
    s = r.state;
    events.push(r.event);
    distances.push(r.distanceM);
  });
  return { state: s, events, distances };
}
const onTrail = { sec: 0, x: 100, y: 0 };
// A reading every 5 seconds from `from` to `to` (seconds), all at the same place.
const hold = (from, to, x, y, acc) => {
  const out = [];
  for (let sec = from; sec <= to; sec += 5) out.push({ sec, x, y, acc });
  return out;
};

describe('distanceToRouteM', () => {
  it('is nothing from a point on the trail', () => {
    expect(distanceToRouteM(pt(250), LINE)).toBeLessThan(0.5);
    expect(distanceToRouteM(pt(500), LINE)).toBeLessThan(0.5);
  });

  it('measures to the line between the trail points, not just to the points', () => {
    // Only two points, 1 km apart: 40 m beside the middle is 40 m away, not 500 m.
    const d = distanceToRouteM(pt(500, 40), [pt(0), pt(1000)]);
    expect(d).toBeGreaterThan(39);
    expect(d).toBeLessThan(41);
  });

  it('measures to the end of the trail once past it', () => {
    const d = distanceToRouteM(pt(1100), LINE);
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
    const before = distanceToRouteM(pt(-80, 60), LINE);
    expect(before).toBeGreaterThan(99);
    expect(before).toBeLessThan(101);
  });

  it('measures to the nearest part of a trail that bends', () => {
    const bent = [pt(0), pt(500), pt(500, 500)];
    const d = distanceToRouteM(pt(540, 300), bent);
    expect(d).toBeGreaterThan(39);
    expect(d).toBeLessThan(41);
    // The far end of the east-west part is further than the north-south part.
    expect(distanceToRouteM(pt(200, 90), bent)).toBeGreaterThan(89);
    expect(distanceToRouteM(pt(200, 90), bent)).toBeLessThan(91);
  });

  it('measures to a trail of a single point', () => {
    const d = distanceToRouteM(pt(30, 40), [pt(0)]);
    expect(d).toBeGreaterThan(49);
    expect(d).toBeLessThan(51);
  });

  it('copes with a repeated trail point', () => {
    const d = distanceToRouteM(pt(100, 25), [pt(0), pt(0), pt(500), pt(500)]);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(24);
    expect(d).toBeLessThan(26);
  });

  it('skips trail points that are not places', () => {
    const d = distanceToRouteM(pt(500, 30), [pt(0), null, { latitude: NaN, longitude: 1 }, { latitude: 'x' }, pt(1000)]);
    expect(d).toBeGreaterThan(29);
    expect(d).toBeLessThan(31);
  });

  it('is Infinity when there is nothing to measure', () => {
    expect(distanceToRouteM(null, LINE)).toBe(Infinity);
    expect(distanceToRouteM({ latitude: NaN, longitude: 0 }, LINE)).toBe(Infinity);
    expect(distanceToRouteM(pt(0), [])).toBe(Infinity);
    expect(distanceToRouteM(pt(0), null)).toBe(Infinity);
    expect(distanceToRouteM(pt(0), [null])).toBe(Infinity);
  });

  it('works across the 180th meridian', () => {
    const line = [{ latitude: 10, longitude: 179.999 }, { latitude: 10, longitude: -179.999 }];
    const d = distanceToRouteM({ latitude: 10.0003, longitude: 180 }, line);
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(40);
  });

  it('uses true distance east to west away from the equator', () => {
    // 100 m east of the end is 100 m, even though a degree of longitude is shorter at 40.7 north
    const d = distanceToRouteM({ latitude: 40.7, longitude: -74 + 1100 / M_LNG }, LINE);
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });
});

describe('stepOffRoute: before and after joining the trail', () => {
  it('says nothing while the hiker has not reached the trail yet (the walk from the car park)', () => {
    const { events, state } = walk([
      { sec: 0, x: 100, y: 400 }, { sec: 60, x: 100, y: 300 }, { sec: 120, x: 100, y: 200 }, { sec: 180, x: 100, y: 100 },
    ]);
    expect(events).toEqual([null, null, null, null]);
    expect(state.joined).toBe(false);
  });

  it('counts as joined once within the back-on-trail distance, and not before', () => {
    expect(walk([{ sec: 0, x: 100, y: BACK_ON_ROUTE_M + 0.5 }]).state.joined).toBe(false);
    expect(walk([{ sec: 0, x: 100, y: BACK_ON_ROUTE_M - 0.5 }]).state.joined).toBe(true);
    expect(walk([{ sec: 0, x: 100, y: 0 }]).state.joined).toBe(true);
  });

  it('warns from the start of a hike that begins on the trail', () => {
    const { events } = walk([onTrail, { sec: 5, x: 100, y: 200 }, { sec: 30, x: 100, y: 200 }]);
    expect(events).toEqual([null, null, 'off']);
  });

  it('once joined, stays joined', () => {
    const { state } = walk([onTrail, { sec: 10, x: 100, y: 500 }]);
    expect(state.joined).toBe(true);
  });
});

describe('stepOffRoute: going off the trail', () => {
  it('warns once the hiker has stayed off the trail long enough, and not before', () => {
    const { events } = walk([
      onTrail,
      { sec: 1, x: 100, y: 150 },
      { sec: 10, x: 100, y: 150 },
      { sec: 20, x: 100, y: 150 },
      { sec: 21, x: 100, y: 150 },
    ]);
    // first seen off at sec 1; 20 s later (sec 21) is the first warning
    expect(events).toEqual([null, null, null, null, 'off']);
  });

  it('warns at exactly the waiting time', () => {
    const { events } = walk([onTrail, { sec: 0, x: 100, y: 150 }, { sec: OFF_ROUTE_AFTER_MS / 1000, x: 100, y: 150 }]);
    expect(events).toEqual([null, null, 'off']);
  });

  it('does not warn a second before the waiting time', () => {
    const { events } = walk([onTrail, { sec: 0, x: 100, y: 150 }, { sec: OFF_ROUTE_AFTER_MS / 1000 - 1, x: 100, y: 150 }]);
    expect(events).toEqual([null, null, null]);
  });

  it('does not warn for a short stray that ends before the waiting time', () => {
    const { events, state } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 15, x: 100, y: 150 }, { sec: 16, x: 100, y: 10 }, { sec: 40, x: 100, y: 10 }]);
    expect(events).toEqual([null, null, null, null, null]);
    expect(state.off).toBe(false);
    expect(state.offSince).toBe(0);
  });

  it('starts the count again after coming back, instead of adding strays together', () => {
    const { events } = walk([
      onTrail,
      { sec: 1, x: 100, y: 150 }, { sec: 15, x: 100, y: 150 }, // 14 s off
      { sec: 16, x: 100, y: 10 }, // back
      { sec: 17, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }, // 13 s off
    ]);
    expect(events.every((e) => e === null)).toBe(true);
  });

  it('is not off at exactly the limit, only beyond it', () => {
    const inside = walk([onTrail, ...hold(1, 100, 100, OFF_ROUTE_M - 0.5)]);
    expect(inside.events.every((e) => e === null)).toBe(true);
    const beyond = walk([onTrail, ...hold(1, 100, 100, OFF_ROUTE_M + 0.5)]);
    expect(beyond.events.filter((e) => e === 'off')).toHaveLength(1);
  });

  it('does not warn for a hiker hovering between the two limits', () => {
    const mid = (OFF_ROUTE_M + BACK_ON_ROUTE_M) / 2;
    const { events } = walk([onTrail, ...hold(1, 200, 100, mid)]);
    expect(events.every((e) => e === null)).toBe(true);
  });

  it('gives each warning the distance from the trail, in whole metres', () => {
    const { distances, events } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }]);
    expect(events[2]).toBe('off');
    expect(distances[2]).toBeGreaterThanOrEqual(149);
    expect(distances[2]).toBeLessThanOrEqual(151);
    expect(Number.isInteger(distances[2])).toBe(true);
  });

  it('marks the hiker as off from the warning on', () => {
    const { state } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }]);
    expect(state.off).toBe(true);
    expect(state.alertedAt).toBe(T0 + 30000);
  });

  it('warns only once while the hiker stays off, until it is time to remind', () => {
    const { events } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }, { sec: 40, x: 100, y: 160 }, { sec: 100, x: 100, y: 170 }]);
    expect(events).toEqual([null, null, 'off', null, null]);
  });
});

describe('stepOffRoute: how good the GPS is', () => {
  it('gives a vague reading more room before it counts as off', () => {
    // 80 m is beyond 60, but with a 30 m accuracy the limit is 60 + 25
    const vague = walk([onTrail, ...hold(1, 100, 100, 80, 30)]);
    expect(vague.events.every((e) => e === null)).toBe(true);
    const sharp = walk([onTrail, ...hold(1, 100, 100, 80, 5)]);
    expect(sharp.events.filter((e) => e === 'off')).toHaveLength(1);
  });

  it('gives only as much room as the accuracy says', () => {
    const limit = OFF_ROUTE_M + 10;
    expect(walk([onTrail, ...hold(1, 100, 100, limit - 2, 10)]).events.includes('off')).toBe(false);
    expect(walk([onTrail, ...hold(1, 100, 100, limit + 2, 10)]).events.includes('off')).toBe(true);
  });

  it('never gives more than the most room, however bad the reading', () => {
    const limit = OFF_ROUTE_M + MAX_ACCURACY_SLACK_M;
    expect(walk([onTrail, ...hold(1, 100, 100, limit - 3, 500)]).events.includes('off')).toBe(false);
    expect(walk([onTrail, ...hold(1, 100, 100, limit + 3, 500)]).events.includes('off')).toBe(true);
  });

  it('also gives the room when deciding the hiker is back', () => {
    const base = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }]).state;
    const y = BACK_ON_ROUTE_M + 10; // inside back limit only with slack
    expect(walk([{ sec: 40, x: 100, y }], { state: base }).events).toEqual([null]);
    expect(walk([{ sec: 40, x: 100, y, acc: 20 }], { state: base }).events).toEqual(['back']);
  });

  it('ignores a missing or silly accuracy', () => {
    [undefined, null, NaN, 'x', -5, 0].forEach((acc) => {
      const r = walk([onTrail, ...hold(1, 100, 100, 80, acc)]);
      expect(r.events.includes('off')).toBe(true);
    });
  });
});

describe('stepOffRoute: coming back, and reminders', () => {
  const strayed = () => walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }]).state;

  it('says the hiker is back once well inside the limit', () => {
    const { events, state, distances } = walk([{ sec: 40, x: 100, y: 10 }], { state: strayed() });
    expect(events).toEqual(['back']);
    expect(state.off).toBe(false);
    expect(state.alertedAt).toBe(0);
    expect(distances[0]).toBeLessThanOrEqual(11);
  });

  it('says the hiker is back at exactly the back-on-trail distance, not just beyond it', () => {
    expect(walk([{ sec: 40, x: 100, y: BACK_ON_ROUTE_M - 1 }], { state: strayed() }).events).toEqual(['back']);
    expect(walk([{ sec: 40, x: 100, y: BACK_ON_ROUTE_M + 3 }], { state: strayed() }).events).toEqual([null]);
  });

  it('is not back while still between the two limits (no flipping at the edge)', () => {
    const mid = (OFF_ROUTE_M + BACK_ON_ROUTE_M) / 2;
    const { events, state } = walk([{ sec: 40, x: 100, y: mid }, { sec: 50, x: 100, y: mid + 2 }], { state: strayed() });
    expect(events).toEqual([null, null]);
    expect(state.off).toBe(true);
  });

  it('says back only once', () => {
    const { events } = walk([{ sec: 40, x: 100, y: 10 }, { sec: 50, x: 100, y: 8 }, { sec: 60, x: 100, y: 5 }], { state: strayed() });
    expect(events).toEqual(['back', null, null]);
  });

  it('warns again on a later stray, after coming back', () => {
    const back = walk([{ sec: 40, x: 100, y: 10 }], { state: strayed() }).state;
    const { events } = walk([{ sec: 50, x: 100, y: 150 }, { sec: 75, x: 100, y: 150 }], { state: back });
    expect(events).toEqual([null, 'off']);
  });

  it('reminds when still off after the reminder time, and not before', () => {
    const s = strayed(); // warned at sec 30
    const { events } = walk([
      { sec: 30 + REMIND_EVERY_MS / 1000 - 1, x: 100, y: 200 },
      { sec: 30 + REMIND_EVERY_MS / 1000, x: 100, y: 200 },
    ], { state: s });
    expect(events).toEqual([null, 'remind']);
  });

  it('reminds again and again, each time after the reminder time', () => {
    const step = REMIND_EVERY_MS / 1000;
    const { events } = walk([
      { sec: 30 + step, x: 100, y: 200 },
      { sec: 30 + step + 60, x: 100, y: 200 },
      { sec: 30 + 2 * step, x: 100, y: 200 },
      { sec: 30 + 3 * step, x: 100, y: 200 },
    ], { state: strayed() });
    expect(events).toEqual(['remind', null, 'remind', 'remind']);
  });

  it('does not remind a hiker who has come back', () => {
    const { events } = walk([{ sec: 40, x: 100, y: 5 }, { sec: 30 + REMIND_EVERY_MS / 1000 + 5, x: 100, y: 5 }], { state: strayed() });
    expect(events).toEqual(['back', null]);
  });
});

describe('stepOffRoute: gaps in the readings', () => {
  it('starts counting the time off again after a long silence', () => {
    // first seen off at sec 1; the next reading is long after (a pause), still off:
    // that is not 20 s of seeing them off
    const gap = (MAX_READING_GAP_MS / 1000) + 5;
    const { events } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 1 + gap, x: 100, y: 150 }, { sec: 1 + gap + 19, x: 100, y: 150 }, { sec: 1 + gap + 20, x: 100, y: 150 }]);
    expect(events).toEqual([null, null, null, null, 'off']);
  });

  it('does not restart the count for a gap that is not long', () => {
    const gap = (MAX_READING_GAP_MS / 1000) - 5;
    const { events } = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 1 + gap, x: 100, y: 150 }]);
    expect(events).toEqual([null, null, 'off']);
  });

  it('still says the hiker is back after a long silence', () => {
    const s = walk([onTrail, { sec: 1, x: 100, y: 150 }, { sec: 30, x: 100, y: 150 }]).state;
    expect(walk([{ sec: 2000, x: 100, y: 5 }], { state: s }).events).toEqual(['back']);
  });
});

describe('stepOffRoute: bad input', () => {
  const s = createOffRoute();
  const inputs = [
    ['no trail', { position: pt(0), route: null, t: T0 }],
    ['an empty trail', { position: pt(0), route: [], t: T0 }],
    ['a one-point trail', { position: pt(0), route: [pt(0)], t: T0 }],
    ['a trail of junk', { position: pt(0), route: [null, 'x', {}], t: T0 }],
    ['no position', { position: null, route: LINE, t: T0 }],
    ['a position that is not a place', { position: { latitude: NaN, longitude: 0 }, route: LINE, t: T0 }],
    ['no time', { position: pt(0), route: LINE }],
    ['a time that is not a number', { position: pt(0), route: LINE, t: 'now' }],
  ];
  it.each(inputs)('says nothing and changes nothing for %s', (_, input) => {
    const r = stepOffRoute(s, input);
    expect(r.event).toBeNull();
    expect(r.distanceM).toBeNull();
    expect(r.state).toBe(s);
  });

  it('starts from a fresh state when given none', () => {
    const r = stepOffRoute(undefined, { position: pt(100), route: LINE, t: T0 });
    expect(r.state.joined).toBe(true);
  });

  it('copes with being called with nothing at all', () => {
    expect(stepOffRoute()).toMatchObject({ event: null, distanceM: null });
  });

  it('does not change the state it is given', () => {
    const before = Object.freeze({ ...createOffRoute(), joined: true });
    const r = stepOffRoute(before, { position: pt(100, 200), route: LINE, t: T0 });
    expect(r.state).not.toBe(before);
    expect(before.offSince).toBe(0);
    expect(r.state.offSince).toBe(T0);
  });
});

describe('words for a warning', () => {
  it('rounds a distance to something that can be said', () => {
    expect(roundedDistance(0)).toEqual({ value: 0, unit: 'm' });
    expect(roundedDistance(64)).toEqual({ value: 60, unit: 'm' });
    expect(roundedDistance(66)).toEqual({ value: 70, unit: 'm' });
    expect(roundedDistance(99)).toEqual({ value: 100, unit: 'm' });
    expect(roundedDistance(100)).toEqual({ value: 100, unit: 'm' });
    expect(roundedDistance(124)).toEqual({ value: 100, unit: 'm' });
    expect(roundedDistance(126)).toEqual({ value: 150, unit: 'm' });
    expect(roundedDistance(999)).toEqual({ value: 1000, unit: 'm' });
    expect(roundedDistance(1000)).toEqual({ value: 1, unit: 'km' });
    expect(roundedDistance(1249)).toEqual({ value: 1.2, unit: 'km' });
    expect(roundedDistance(12500)).toEqual({ value: 12.5, unit: 'km' });
  });

  it('rounds a distance in feet, then miles, for imperial', () => {
    expect(roundedDistance(0, 'imperial')).toEqual({ value: 0, unit: 'ft' });
    expect(roundedDistance(10, 'imperial')).toEqual({ value: 30, unit: 'ft' }); // 32.8 ft, nearest 10
    expect(roundedDistance(30, 'imperial')).toEqual({ value: 100, unit: 'ft' }); // 98.4 ft
    expect(roundedDistance(40, 'imperial')).toEqual({ value: 150, unit: 'ft' }); // 131 ft, nearest 50
    expect(roundedDistance(80, 'imperial')).toEqual({ value: 250, unit: 'ft' }); // 262 ft
    expect(roundedDistance(150, 'imperial')).toEqual({ value: 500, unit: 'ft' }); // 492 ft
    expect(roundedDistance(200, 'imperial')).toEqual({ value: 0.1, unit: 'mi' }); // 656 ft is over a tenth of a mile
    expect(roundedDistance(500, 'imperial')).toEqual({ value: 0.3, unit: 'mi' });
    expect(roundedDistance(1609.344, 'imperial')).toEqual({ value: 1, unit: 'mi' });
    expect(roundedDistance(20000, 'imperial')).toEqual({ value: 12.4, unit: 'mi' });
    expect(roundedDistance(150, 'metric')).toEqual({ value: 150, unit: 'm' });
    expect(roundedDistance(150)).toEqual({ value: 150, unit: 'm' });
  });

  it('copes with a distance that is not a number', () => {
    expect(roundedDistance(NaN, 'imperial')).toEqual({ value: 0, unit: 'ft' });
    expect(roundedDistance(-40, 'imperial')).toEqual({ value: 0, unit: 'ft' });
    expect(roundedDistance(NaN)).toEqual({ value: 0, unit: 'm' });
    expect(roundedDistance(-40)).toEqual({ value: 0, unit: 'm' });
    expect(roundedDistance(undefined)).toEqual({ value: 0, unit: 'm' });
  });

  it('writes a distance short and spoken', () => {
    expect(distanceLabel(84)).toBe('80 m');
    expect(distanceLabel(1500)).toBe('1.5 km');
    expect(distanceWords(84)).toBe('80 meters');
    expect(distanceWords(1500)).toBe('1.5 kilometers');
  });

  it('writes a distance short and spoken in feet and miles for imperial', () => {
    expect(distanceLabel(84, 'imperial')).toBe('300 ft');
    expect(distanceLabel(1500, 'imperial')).toBe('0.9 mi');
    expect(distanceWords(84, 'imperial')).toBe('300 feet');
    expect(distanceWords(1500, 'imperial')).toBe('0.9 miles');
    expect(distanceWords(1609.344, 'imperial')).toBe('1 mile');
    expect(distanceWords(3000, 'imperial')).toBe('1.9 miles');
  });

  it('warns in feet or miles for imperial, in the same words', () => {
    const m = describeOffRoute('off', 84, 'imperial');
    expect(m.title).toBe('Off the trail');
    expect(m.body).toBe('About 300 ft from the trail you chose.');
    expect(m.speech).toBe('You may be off the trail. You are about 300 feet from the route.');
    expect(describeOffRoute('remind', 84, 'metric').body).toBe('About 80 m from the trail you chose.');
    expect(describeOffRoute('back', 5, 'imperial').speech).toBe('Back on the trail.');
  });

  it('says what is wrong, how far, and for how long it is spoken', () => {
    ['off', 'remind'].forEach((event) => {
      const m = describeOffRoute(event, 84);
      expect(m.title).toBe('Off the trail');
      expect(m.body).toBe('About 80 m from the trail you chose.');
      expect(m.speech).toBe('You may be off the trail. You are about 80 meters from the route.');
    });
  });

  it('says the hiker is back', () => {
    const m = describeOffRoute('back', 5);
    expect(m.title).toBe('Back on the trail');
    expect(m.speech).toBe('Back on the trail.');
    expect(m.body).toBeTruthy();
  });

  it('has nothing to say for anything else', () => {
    expect(describeOffRoute(null, 10)).toBeNull();
    expect(describeOffRoute(undefined, 10)).toBeNull();
    expect(describeOffRoute('maybe', 10)).toBeNull();
  });
});

// The tuned numbers, written out, so changing one is a decision and not an accident.
describe('the numbers the warning is tuned to', () => {
  const secOf = (steps, events, name) => steps[events.indexOf(name)].sec;

  it('warns at more than 60 m from the trail, not at 55 m', () => {
    const quiet = walk([onTrail, ...hold(5, 65, 100, 55)]);
    expect(quiet.events.every((e) => e === null)).toBe(true);
    const steps = [onTrail, ...hold(5, 65, 100, 65)];
    const loud = walk(steps);
    expect(loud.events).toContain('off');
    expect(secOf(steps, loud.events, 'off')).toBe(25); // seen off at 5 s, still off 20 s later
  });

  it('does not warn for 15 s off the trail, and does for 20 s', () => {
    expect(walk([onTrail, ...hold(5, 20, 100, 100)]).events).not.toContain('off');
    expect(walk([onTrail, ...hold(5, 25, 100, 100)]).events).toContain('off');
  });

  it('counts as back at 30 m, not at 40 m', () => {
    const off = hold(5, 30, 100, 100);
    expect(walk([onTrail, ...off, { sec: 35, x: 100, y: 40 }]).events.pop()).toBeNull();
    expect(walk([onTrail, ...off, { sec: 35, x: 100, y: 30 }]).events.pop()).toBe('back');
  });

  it('reminds 3 minutes after the warning, not before and not much after', () => {
    const steps = [onTrail, ...hold(5, 380, 100, 100)]; // the next reminder would be at 385 s
    const r = walk(steps);
    expect(secOf(steps, r.events, 'off')).toBe(25);
    expect(secOf(steps, r.events, 'remind')).toBe(205);
    expect(r.events.filter((e) => e === 'remind')).toHaveLength(1);
  });

  it('gives a vague GPS reading 25 m more room, and no more', () => {
    // Accuracy 100 m: the limit is 60 + 25 = 85 m.
    expect(walk([{ ...onTrail, acc: 100 }, ...hold(5, 60, 100, 80, 100)]).events).not.toContain('off');
    expect(walk([{ ...onTrail, acc: 100 }, ...hold(5, 60, 100, 90, 100)]).events).toContain('off');
  });

  it('starts the count again after a minute without a reading, but not after half a minute', () => {
    const afterHalfMinute = [onTrail, { sec: 10, x: 100, y: 100 }, { sec: 40, x: 100, y: 100 }];
    expect(walk(afterHalfMinute).events.pop()).toBe('off'); // 30 s apart: still the same stretch off the trail
    const afterAMinute = [onTrail, { sec: 10, x: 100, y: 100 }, { sec: 70, x: 100, y: 100 }];
    expect(walk(afterAMinute).events.pop()).toBeNull(); // 60 s apart: counted from 70 s
    const later = [...afterAMinute, ...hold(75, 95, 100, 100)];
    const r = walk(later);
    expect(secOf(later, r.events, 'off')).toBe(90);
  });
});

describe('the edges of the map and short trails', () => {
  const lat = 40.7;
  it('measures across the date line from either side', () => {
    const route = [{ latitude: lat, longitude: 179.9999 }, { latitude: lat + 0.001, longitude: 179.9999 }];
    const fromWest = distanceToRouteM({ latitude: lat + 0.0005, longitude: -179.9999 }, route);
    expect(fromWest).toBeGreaterThan(16);
    expect(fromWest).toBeLessThan(18);
    const route2 = [{ latitude: lat, longitude: -179.9999 }, { latitude: lat + 0.001, longitude: -179.9999 }];
    const fromEast = distanceToRouteM({ latitude: lat + 0.0005, longitude: 179.9999 }, route2);
    expect(fromEast).toBeGreaterThan(16);
    expect(fromEast).toBeLessThan(18);
  });

  it('works with a trail of exactly two points, and not with one', () => {
    const two = stepOffRoute(createOffRoute(), { position: pt(100, 5), route: [pt(0), pt(1000)], t: T0 });
    expect(two.distanceM).toBe(5);
    expect(two.state.joined).toBe(true);
    const one = stepOffRoute(createOffRoute(), { position: pt(100, 5), route: [pt(0)], t: T0 });
    expect(one.distanceM).toBeNull();
  });
});
