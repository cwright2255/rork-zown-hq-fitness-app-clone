import {
  createTracker, startTracker, applyFix, applyFixes, pauseTracker, resumeTracker, setAutoPause,
  trackedMs, gpsStatus, shouldAdoptSession, pauseTimedOut, finishTracker, intervalAt, elevationGain,
  plannedSeconds, sessionCounts, PROGRAM_CREDIT_FRACTION,
  ADOPT_WITHIN_MS, PAUSED_GPS_TIMEOUT_MS, GPS_LOST_MS, RESUME_HOLD_MS,
} from '../lib/runTracker';
import { distanceM } from '../lib/gpsFilter';

/* ---------- simulated GPS ---------- */

// Seeded random numbers so every run of the tests sees the same "noise".
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(next(), 1e-12))) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

const LAT0 = 40.7;
const LNG0 = -74;
const M_PER_DEG = 111320;
const toLatLng = (x, y) => ({
  latitude: LAT0 + y / M_PER_DEG,
  longitude: LNG0 + x / (M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)),
});

// The true path, one point per second. Segments:
//   { meters, speed, heading (degrees, 0 = north), climb? }  moving
//   { stand: seconds }                                        standing still
function truthPath(plan) {
  const out = [{ t: 0, x: 0, y: 0, z: 0, moving: false, speed: 0 }];
  let { x, y, z, t } = out[0];
  plan.forEach((seg) => {
    if (seg.stand) {
      for (let i = 0; i < seg.stand; i += 1) { t += 1000; out.push({ t, x, y, z, moving: false, speed: 0 }); }
      return;
    }
    const h = (seg.heading * Math.PI) / 180;
    const n = Math.round(seg.meters / seg.speed);
    for (let i = 0; i < n; i += 1) {
      t += 1000; x += Math.sin(h) * seg.speed; y += Math.cos(h) * seg.speed; z += (seg.climb || 0) / n;
      out.push({ t, x, y, z, moving: true, speed: seg.speed });
    }
  });
  return out;
}

// Noisy readings of that path. Errors drift slowly (`tau` seconds), like real GPS.
//   noise: { sigma, tau, accBase, doppler, altSigma, altTau, outliers, dropBetween }
function sampleGps(truth, noise, seed, startMs) {
  const r = rng(seed);
  const phi = Math.exp(-1 / (noise.tau || 1));
  const s2 = Math.sqrt(1 - phi * phi);
  const phiZ = Math.exp(-1 / (noise.altTau || 1));
  const s2z = Math.sqrt(1 - phiZ * phiZ);
  let ex = r.gauss() * noise.sigma;
  let ey = r.gauss() * noise.sigma;
  let ez = r.gauss() * (noise.altSigma || 0);
  const fixes = [];
  truth.forEach((p, i) => {
    ex = phi * ex + s2 * noise.sigma * r.gauss();
    ey = phi * ey + s2 * noise.sigma * r.gauss();
    ez = phiZ * ez + s2z * (noise.altSigma || 0) * r.gauss();
    const sec = p.t / 1000;
    if (i === 0) return;
    if ((noise.dropBetween || []).some(([a, b]) => sec >= a && sec < b)) return;
    let x = p.x + ex;
    let y = p.y + ey;
    const jump = (noise.outliers || []).find((o) => o.at === sec);
    if (jump) { const ang = r.next() * 2 * Math.PI; x += Math.cos(ang) * jump.meters; y += Math.sin(ang) * jump.meters; }
    fixes.push({
      timestamp: startMs + p.t,
      coords: {
        ...toLatLng(x, y),
        accuracy: noise.accBase + Math.abs(r.gauss()) * 1.5,
        speed: noise.doppler ? Math.max(0, p.speed + r.gauss() * 0.25) : -1,
        altitude: 50 + p.z + ez,
        altitudeAccuracy: noise.altSigma ? 6 : -1,
        heading: 0,
      },
    });
  });
  return fixes;
}

const T0 = 1_700_000_000_000;
const rectangle = (speed, side, laps) => {
  const plan = [];
  for (let i = 0; i < laps * 4; i += 1) plan.push({ meters: side, speed, heading: (i % 4) * 90 });
  return plan;
};
const trueLength = (truth) => truth.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - truth[i - 1].x, p.y - truth[i - 1].y) : 0), 0);
const trueMoving = (truth) => truth.filter((p) => p.moving).length;

// Runs a whole simulated outing through the tracker.
function simulate(plan, noise, seed, { autoPause = true, tweak } = {}) {
  const truth = truthPath(plan);
  let fixes = sampleGps(truth, noise, seed, T0);
  if (tweak) fixes = tweak(fixes);
  let s = startTracker(createTracker({ autoPause }), T0);
  const statuses = [s.status];
  fixes.forEach((f) => {
    s = applyFix(s, f);
    if (s.status !== statuses[statuses.length - 1]) statuses.push(s.status);
  });
  const summary = finishTracker(s, T0 + truth[truth.length - 1].t);
  return { s, summary, truth, fixes, statuses, truthM: trueLength(truth), movingS: trueMoving(truth) };
}

const GOOD = { sigma: 3, tau: 8, accBase: 5, doppler: true };
const JITTERY = { sigma: 4, tau: 0.01, accBase: 6, doppler: true }; // every reading wrong by itself
const NO_SPEED = { sigma: 4, tau: 0.01, accBase: 6, doppler: false }; // phone gives no speed
const pctErr = (km, meters) => ((km * 1000 - meters) / meters) * 100;

/* ---------- noise-free helpers for exact checks ---------- */

const fixAt = (sec, x, y = 0, extra = {}) => ({
  timestamp: T0 + sec * 1000,
  coords: { ...toLatLng(x, y), accuracy: 4, speed: -1, altitude: null, altitudeAccuracy: -1, heading: 0, ...extra },
});

// Straight run east: readings every second from `from` to `to` (seconds), x = x0 + v*(sec-from)
function straight(s, { from, to, v, x0 = 0, doppler = true, extra = {} }) {
  let st = s;
  for (let sec = from; sec <= to; sec += 1) {
    st = applyFix(st, fixAt(sec, x0 + v * (sec - from), 0, { speed: doppler ? v : -1, ...extra }));
  }
  return st;
}
// Standing at x for the seconds in [from, to]
const stand = (s, { from, to, x, doppler = true }) => straight(s, { from, to, v: 0, x0: x, doppler });

/* ---------- tests ---------- */

describe('a new run', () => {
  it('starts running with nothing counted', () => {
    const s = startTracker(createTracker(), T0);
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(T0);
    expect(s.distanceM).toBe(0);
    expect(trackedMs(s, T0)).toBe(0);
  });

  it('ignores readings until a run is started', () => {
    const idle = createTracker();
    expect(applyFix(idle, fixAt(1, 0))).toBe(idle);
    expect(trackedMs(idle, T0 + 5000)).toBe(0);
  });

  it('keeps the auto-pause choice between runs', () => {
    expect(startTracker(createTracker({ autoPause: false }), T0).autoPause).toBe(false);
  });

  it('counts the clock from the moment of the start', () => {
    const s = startTracker(createTracker(), T0);
    expect(trackedMs(s, T0 + 7500)).toBe(7500);
  });
});

describe('readings that are thrown away', () => {
  const started = () => startTracker(createTracker(), T0);

  it('ignores a cached position from before the run started', () => {
    const s = applyFix(started(), fixAt(-600, 0));
    expect(s.route).toHaveLength(0);
    expect(s.lastFixT).toBe(0);
  });

  it('ignores duplicates and readings that arrive out of order', () => {
    let s = applyFix(started(), fixAt(2, 0));
    const after = applyFix(s, fixAt(2, 50));
    expect(after).toBe(s);
    s = applyFix(s, fixAt(1, 50));
    expect(s.route).toHaveLength(1);
  });

  it('ignores broken readings', () => {
    const s = started();
    expect(applyFix(s, null)).toBe(s);
    expect(applyFix(s, { timestamp: T0 + 1000, coords: { latitude: 0, longitude: 0 } })).toBe(s);
    expect(applyFix(s, fixAt(1, 0, 0, { accuracy: -1 }))).toBe(s);
  });

  it('does not use a vague position, but the clock keeps running', () => {
    let s = applyFix(started(), fixAt(1, 0, 0, { accuracy: 80 }));
    expect(s.route).toHaveLength(0);
    expect(s.gps).toBe('weak');
    s = applyFix(s, fixAt(10, 0, 0, { accuracy: 80 }));
    expect(trackedMs(s, T0 + 10000)).toBe(10000);
  });

  it('does not count a one-off jump across town', () => {
    let s = straight(started(), { from: 1, to: 30, v: 3 });
    const before = s.distanceM;
    s = applyFix(s, fixAt(31, 90 + 600, 400, { speed: 3 }));
    expect(s.distanceM).toBe(before);
    s = straight(s, { from: 32, to: 60, v: 3, x0: 93 });
    expect(s.distanceM).toBeGreaterThan(160);
    expect(s.distanceM).toBeLessThan(185);
  });

  it('believes a new place that keeps being reported, without counting the gap', () => {
    let s = straight(started(), { from: 1, to: 30, v: 3 });
    const before = s.distanceM;
    for (let sec = 31; sec <= 45; sec += 1) s = applyFix(s, fixAt(sec, 5000 + (sec - 31) * 3, 0, { speed: 3 }));
    expect(s.distanceM - before).toBeLessThan(80);
    expect(distanceM(s.current, toLatLng(5000 + 42, 0))).toBeLessThan(15);
  });

  it('batches work the same as one at a time', () => {
    const fixes = Array.from({ length: 40 }, (_, i) => fixAt(i + 1, (i + 1) * 3, 0, { speed: 3 }));
    const one = fixes.reduce((st, f) => applyFix(st, f), startTracker(createTracker(), T0));
    const batch = applyFixes(startTracker(createTracker(), T0), fixes);
    expect(batch).toEqual(one);
    expect(applyFixes(one, undefined)).toBe(one);
  });
});

describe('distance, time and splits on a clean run', () => {
  // 4 m/s is exactly 250 s per kilometre
  const run = () => straight(startTracker(createTracker(), T0), { from: 1, to: 620, v: 4 });

  it('adds up the distance in kilometres', () => {
    const s = run();
    const km = finishTracker(s, T0 + 620000).distance;
    expect(km).toBeGreaterThan(2.4);
    expect(km).toBeLessThan(2.49);
  });

  it('records the time of each full kilometre', () => {
    const { splits } = finishTracker(run(), T0 + 620000);
    expect(splits).toHaveLength(2);
    splits.forEach((sec) => {
      expect(sec).toBeGreaterThan(246);
      expect(sec).toBeLessThan(254);
    });
  });

  it('has moving time equal to the time that passed', () => {
    const { duration } = finishTracker(run(), T0 + 620000);
    expect(duration).toBe(620);
  });

  it('moves the clock on between readings', () => {
    const s = run();
    expect(trackedMs(s, s.lastT + 3000)).toBe(s.movingMs + 3000);
  });

  it('has one split per kilometre even if one reading crosses two', () => {
    let s = startTracker(createTracker(), T0);
    s = applyFix(s, fixAt(1, 0, 0, { speed: 3 }));
    // 20 s without readings while moving at 100 m/s is a jump; use a legal long gap instead:
    s = applyFix(s, fixAt(300, 2500, 0, { speed: 8 })); // 2.5 km in 299 s = 8.4 m/s
    const { splits, distance } = finishTracker(s, T0 + 300000);
    expect(distance).toBeGreaterThan(2.4);
    expect(splits).toHaveLength(2);
    expect(splits[0] + splits[1]).toBeLessThan(300);
    expect(splits[0]).toBeGreaterThan(100);
  });

  it('saves the route as map points', () => {
    const { coords } = finishTracker(run(), T0 + 620000);
    expect(coords.length).toBeGreaterThan(200);
    expect(Object.keys(coords[0]).sort()).toEqual(['latitude', 'longitude']);
  });

  it('describes the run for saving', () => {
    const out = finishTracker(run(), T0 + 620000);
    expect(out.startTime).toBe(new Date(T0).toISOString());
    expect(out.elevGain).toBe(0);
    expect(out.elevLoss).toBe(0);
  });
});

describe('pausing by hand', () => {
  it('stops the clock and the distance', () => {
    let s = straight(startTracker(createTracker(), T0), { from: 1, to: 60, v: 3 });
    s = pauseTracker(s, T0 + 60000);
    const km = s.distanceM;
    const ms = s.movingMs;
    expect(s.status).toBe('paused');
    s = straight(s, { from: 61, to: 120, v: 3, x0: 180 });
    expect(s.distanceM).toBe(km);
    expect(trackedMs(s, T0 + 120000)).toBe(ms);
  });

  it('does not count the ground covered while paused when you carry on', () => {
    let s = straight(startTracker(createTracker(), T0), { from: 1, to: 60, v: 3 });
    s = pauseTracker(s, T0 + 60000);
    s = straight(s, { from: 61, to: 120, v: 3, x0: 180 }); // walked 180 m while paused
    s = resumeTracker(s, T0 + 120000);
    s = straight(s, { from: 121, to: 180, v: 3, x0: 360 });
    expect(s.status).toBe('running');
    const { distance, duration } = finishTracker(s, T0 + 180000);
    expect(distance).toBeGreaterThan(0.33);
    expect(distance).toBeLessThan(0.38);
    expect(duration).toBe(120);
  });

  it('only pauses a run that is going', () => {
    const idle = createTracker();
    expect(pauseTracker(idle, T0)).toBe(idle);
    const paused = pauseTracker(startTracker(createTracker(), T0), T0 + 1000);
    expect(resumeTracker(startTracker(createTracker(), T0), T0 + 1000).status).toBe('running');
    expect(pauseTracker(paused, T0 + 2000)).toBe(paused);
  });

  it('notes when it was paused, for the long-pause check', () => {
    const s = pauseTracker(startTracker(createTracker(), T0), T0 + 5000);
    expect(s.pausedAt).toBe(T0 + 5000);
    expect(pauseTimedOut(s, T0 + 5000 + PAUSED_GPS_TIMEOUT_MS - 1)).toBe(false);
    expect(pauseTimedOut(s, T0 + 5000 + PAUSED_GPS_TIMEOUT_MS)).toBe(true);
    expect(pauseTimedOut(resumeTracker(s, T0 + 9000), T0 + 9000 + PAUSED_GPS_TIMEOUT_MS)).toBe(false);
  });
});

describe('auto-pause on a clean run', () => {
  const runStopRun = (opts = {}) => {
    let s = startTracker(createTracker({ autoPause: opts.autoPause !== false }), T0);
    s = straight(s, { from: 1, to: 60, v: 3 });
    const atStop = s;
    s = stand(s, { from: 61, to: 120, x: 177 });
    const afterStand = s;
    s = straight(s, { from: 121, to: 180, v: 3, x0: 177 });
    return { atStop, afterStand, end: s };
  };

  it('pauses soon after you stop', () => {
    const { afterStand } = runStopRun();
    expect(afterStand.status).toBe('auto');
  });

  it('leaves out the time spent standing', () => {
    const { end } = runStopRun();
    const { duration } = finishTracker(end, T0 + 180000);
    expect(duration).toBeGreaterThan(112);
    expect(duration).toBeLessThan(126);
  });

  it('starts again when you move off, and counts the run from there', () => {
    const { end } = runStopRun();
    expect(end.status).toBe('running');
    const { distance } = finishTracker(end, T0 + 180000);
    expect(distance).toBeGreaterThan(0.33);
    expect(distance).toBeLessThan(0.37);
  });

  it('adds nothing while you stand still', () => {
    const { atStop, afterStand } = runStopRun();
    expect(afterStand.distanceM - atStop.distanceM).toBeLessThan(2);
  });

  it('does nothing when auto-pause is off, but still does not count shuffling in place', () => {
    const { atStop, afterStand, end } = runStopRun({ autoPause: false });
    expect(afterStand.status).toBe('running');
    expect(afterStand.distanceM - atStop.distanceM).toBeLessThan(2);
    // the clock keeps going, as the runner chose
    expect(finishTracker(end, T0 + 180000).duration).toBe(180);
  });

  it('turning it off while paused carries on with the run', () => {
    const { afterStand } = runStopRun();
    const s = setAutoPause(afterStand, false, T0 + 120000);
    expect(s.status).toBe('running');
    expect(s.autoPause).toBe(false);
  });

  it('turning it on or off at other times just changes the setting', () => {
    const s = startTracker(createTracker(), T0);
    expect(setAutoPause(s, false).autoPause).toBe(false);
    expect(setAutoPause(setAutoPause(s, false), true).autoPause).toBe(true);
  });

  it('does not pause again straight after you resume by hand', () => {
    const { afterStand } = runStopRun();
    let s = resumeTracker(afterStand, T0 + 120000);
    expect(s.status).toBe('running');
    s = stand(s, { from: 121, to: 120 + RESUME_HOLD_MS / 1000 - 2, x: 177 });
    expect(s.status).toBe('running');
    s = stand(s, { from: 120 + RESUME_HOLD_MS / 1000 - 1, to: 120 + RESUME_HOLD_MS / 1000 + 14, x: 177 });
    expect(s.status).toBe('auto');
  });

  it('pauses on its own position data when the phone gives no speed', () => {
    let s = startTracker(createTracker(), T0);
    s = straight(s, { from: 1, to: 60, v: 3, doppler: false });
    s = stand(s, { from: 61, to: 120, x: 177, doppler: false });
    expect(s.status).toBe('auto');
    s = straight(s, { from: 121, to: 150, v: 3, x0: 177, doppler: false });
    expect(s.status).toBe('running');
  });

  it('does not pause a slow walk', () => {
    let s = startTracker(createTracker(), T0);
    s = straight(s, { from: 1, to: 200, v: 1.1, doppler: false });
    expect(s.status).toBe('running');
    expect(s.distanceM).toBeGreaterThan(205);
  });

  it('does not trust a phone that reports zero speed while clearly moving', () => {
    // Some Android phones send speed 0 on every reading.
    const s = straight(startTracker(createTracker(), T0), { from: 1, to: 120, v: 2.5, extra: { speed: 0 } });
    expect(s.status).toBe('running');
    expect(s.distanceM).toBeGreaterThan(280);
  });
});

describe('height on a clean run', () => {
  it('counts a climb while moving', () => {
    let s = startTracker(createTracker(), T0);
    for (let sec = 1; sec <= 400; sec += 1) {
      s = applyFix(s, fixAt(sec, sec * 3, 0, { speed: 3, altitude: 50 + Math.min(sec, 300) * 0.2, altitudeAccuracy: 4 }));
    }
    expect(elevationGain(s)).toBeGreaterThan(48);
    expect(elevationGain(s)).toBeLessThan(62);
    expect(finishTracker(s, T0 + 400000).elevLoss).toBe(0);
  });

  it('ignores height changes while paused', () => {
    let s = startTracker(createTracker(), T0);
    for (let sec = 1; sec <= 60; sec += 1) s = applyFix(s, fixAt(sec, sec * 3, 0, { speed: 3, altitude: 50, altitudeAccuracy: 4 }));
    s = pauseTracker(s, T0 + 60000);
    for (let sec = 61; sec <= 300; sec += 1) s = applyFix(s, fixAt(sec, 180, 0, { speed: 0, altitude: 200, altitudeAccuracy: 4 }));
    s = resumeTracker(s, T0 + 300000);
    for (let sec = 301; sec <= 360; sec += 1) s = applyFix(s, fixAt(sec, 180 + (sec - 300) * 3, 0, { speed: 3, altitude: 200, altitudeAccuracy: 4 }));
    expect(elevationGain(s)).toBeLessThan(5);
  });

  it('works without any height readings', () => {
    const s = straight(startTracker(createTracker(), T0), { from: 1, to: 30, v: 3 });
    expect(s.elev).toBeNull();
    expect(elevationGain(s)).toBe(0);
  });
});

describe('GPS signal and sessions', () => {
  it('reports searching until the first reading', () => {
    expect(gpsStatus(createTracker(), T0)).toBe('searching');
    expect(gpsStatus(startTracker(createTracker(), T0), T0 + 3000)).toBe('searching');
  });

  it('reports the quality of the latest reading, and lost after a silence', () => {
    let s = applyFix(startTracker(createTracker(), T0), fixAt(1, 0, 0, { accuracy: 5 }));
    expect(gpsStatus(s, T0 + 2000)).toBe('good');
    s = applyFix(s, fixAt(2, 3, 0, { accuracy: 20 }));
    expect(gpsStatus(s, T0 + 3000)).toBe('fair');
    s = applyFix(s, fixAt(3, 6, 0, { accuracy: 50 }));
    expect(gpsStatus(s, T0 + 4000)).toBe('weak');
    expect(gpsStatus(s, T0 + 3000 + GPS_LOST_MS + 1)).toBe('lost');
  });

  it('picks a recent run up again, but not an old or finished one', () => {
    const s = straight(startTracker(createTracker(), T0), { from: 1, to: 10, v: 3 });
    expect(shouldAdoptSession(s, T0 + 60000)).toBe(true);
    expect(shouldAdoptSession(s, T0 + 10000 + ADOPT_WITHIN_MS + 1)).toBe(false);
    expect(shouldAdoptSession(createTracker(), T0)).toBe(false);
    expect(shouldAdoptSession(null, T0)).toBe(false);
  });
});

describe('run/walk program timing', () => {
  const plan = [{ seconds: 60, cue: 'Run' }, { seconds: 90, cue: 'Walk' }, { seconds: 60, cue: 'Run' }];

  it('finds the interval for a moving time', () => {
    expect(intervalAt(plan, 0)).toEqual({ index: 0, secondsLeft: 60, done: false });
    expect(intervalAt(plan, 59.2)).toEqual({ index: 0, secondsLeft: 1, done: false });
    expect(intervalAt(plan, 60)).toEqual({ index: 1, secondsLeft: 90, done: false });
    expect(intervalAt(plan, 209)).toEqual({ index: 2, secondsLeft: 1, done: false });
  });

  it('says when the session is over', () => {
    expect(intervalAt(plan, 210)).toEqual({ index: 2, secondsLeft: 0, done: true });
    expect(intervalAt(plan, 999).done).toBe(true);
  });

  it('copes with no program', () => {
    expect(intervalAt(null, 5)).toBeNull();
    expect(intervalAt([], 5)).toBeNull();
    expect(intervalAt(plan, -5).index).toBe(0);
  });
});

/* ---------- simulated runs with realistic GPS noise ---------- */

describe('simulated runs with noisy GPS', () => {
  const SEEDS = [1, 2, 3];

  it('a 5 km run lands within 2% of the real distance and gets every split about right', () => {
    SEEDS.forEach((seed) => {
      const r = simulate(rectangle(3, 250, 5), GOOD, seed);
      expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(2);
      expect(r.summary.duration).toBe(r.movingS);
      expect(r.summary.splits).toHaveLength(4);
      r.summary.splits.forEach((sec) => {
        expect(sec).toBeGreaterThan(320);
        expect(sec).toBeLessThan(347);
      });
      expect(r.statuses).toEqual(['running']);
    });
  });

  it('is accurate even when every single reading is off (white noise)', () => {
    SEEDS.forEach((seed) => {
      const r = simulate(rectangle(3, 250, 5), JITTERY, seed);
      expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(2);
    });
  });

  it('adding up raw readings would have been wildly off', () => {
    const r = simulate(rectangle(3, 250, 5), JITTERY, 1);
    let naive = 0;
    for (let i = 1; i < r.fixes.length; i += 1) naive += distanceM(r.fixes[i - 1].coords, r.fixes[i].coords);
    expect(pctErr(naive / 1000, r.truthM)).toBeGreaterThan(50);
    expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(2);
  });

  it('a slower 2 m/s run is accurate too', () => {
    SEEDS.forEach((seed) => {
      const r = simulate(rectangle(2, 200, 4), GOOD, seed);
      expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3);
    });
  });

  it('a walk is within 4%, with or without the phone\'s own speed', () => {
    SEEDS.forEach((seed) => {
      [GOOD, NO_SPEED].forEach((noise) => {
        const r = simulate(rectangle(1.4, 150, 5), noise, seed);
        expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(4);
        expect(r.summary.duration).toBeGreaterThan(r.movingS - 12);
        expect(r.summary.duration).toBeLessThanOrEqual(r.movingS);
      });
    });
  });

  describe('with stops (60 s, 30 s and 45 s)', () => {
    const outing = [
      { meters: 900, speed: 3, heading: 0 }, { stand: 60 },
      { meters: 900, speed: 3, heading: 90 }, { stand: 30 },
      { meters: 420, speed: 1.4, heading: 180 }, { stand: 45 },
      { meters: 600, speed: 3, heading: 270 },
    ];

    [['GOOD', GOOD], ['JITTERY', JITTERY], ['NO_SPEED', NO_SPEED]].forEach(([label, noise]) => {
      it(`pauses once per stop and keeps moving time within 20 s (${label})`, () => {
        SEEDS.forEach((seed) => {
          const r = simulate(outing, noise, seed);
          // running, auto, running, auto, running, auto, running
          expect(r.statuses).toEqual(['running', 'auto', 'running', 'auto', 'running', 'auto', 'running']);
          expect(r.summary.duration).toBeGreaterThan(r.movingS - 15);
          expect(r.summary.duration).toBeLessThan(r.movingS + 20);
          expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3.5);
        });
      });
    });

    it('with auto-pause off the clock includes the stops, but standing still adds no distance', () => {
      const r = simulate(outing, GOOD, 2, { autoPause: false });
      expect(r.statuses).toEqual(['running']);
      expect(r.summary.duration).toBe(r.truth.length - 1);
      expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3.5);
    });
  });

  describe('bad GPS moments', () => {
    it('jumps of 60 to 200 m are ignored', () => {
      const noise = { ...GOOD, outliers: [{ at: 200, meters: 60 }, { at: 700, meters: 120 }, { at: 1100, meters: 200 }] };
      SEEDS.forEach((seed) => {
        const r = simulate(rectangle(3, 250, 4), noise, seed);
        expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3);
      });
    });

    it('smaller jumps of 15 to 25 m do little damage', () => {
      const noise = { ...GOOD, outliers: [100, 300, 500, 700, 900, 1100].map((at, i) => ({ at, meters: 15 + i * 2 })) };
      SEEDS.forEach((seed) => {
        const r = simulate(rectangle(3, 250, 4), noise, seed);
        expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3);
      });
    });

    it('a 40 second tunnel loses little and the time still counts', () => {
      SEEDS.forEach((seed) => {
        const r = simulate(rectangle(3, 250, 4), { ...GOOD, dropBetween: [[400, 440]] }, seed);
        expect(r.summary.distance * 1000).toBeGreaterThan(r.truthM * 0.95);
        expect(r.summary.distance * 1000).toBeLessThan(r.truthM * 1.02);
        expect(r.summary.duration).toBe(r.movingS);
      });
    });

    it('ignores a poor signal at the start, then picks up', () => {
      const r = simulate(rectangle(3, 250, 2), GOOD, 3, {
        tweak: (fixes) => fixes.map((f, i) => (i < 20
          ? { ...f, coords: { ...f.coords, accuracy: 80, latitude: f.coords.latitude + 0.0004 } }
          : f)),
      });
      expect(r.summary.distance * 1000).toBeGreaterThan(r.truthM - 100);
      expect(r.summary.distance * 1000).toBeLessThan(r.truthM + 5);
    });

    it('ignores a cached position from earlier, even with a high-accuracy label', () => {
      const r = simulate(rectangle(3, 250, 2), GOOD, 3, {
        tweak: (fixes) => [{ ...fixes[0], timestamp: T0 - 600000, coords: { ...fixes[0].coords, latitude: fixes[0].coords.latitude + 0.01 } }, ...fixes],
      });
      expect(Math.abs(pctErr(r.summary.distance, r.truthM))).toBeLessThan(3);
    });
  });

  describe('elevation', () => {
    const climb = [{ meters: 1000, speed: 3, heading: 0 }, { meters: 1000, speed: 3, heading: 0, climb: 100 }, { meters: 1000, speed: 3, heading: 0 }];
    const flat = [{ meters: 5000, speed: 3, heading: 0 }];
    const hills = [];
    for (let i = 0; i < 4; i += 1) { hills.push({ meters: 500, speed: 3, heading: 0, climb: 25 }); hills.push({ meters: 500, speed: 3, heading: 0, climb: -25 }); }
    const heightNoise = { ...GOOD, altSigma: 3, altTau: 30 };

    it('a flat 5 km adds almost no climb', () => {
      SEEDS.forEach((seed) => {
        const { summary } = simulate(flat, heightNoise, seed);
        expect(summary.elevGain).toBeLessThan(15);
        expect(summary.elevLoss).toBeLessThan(15);
      });
    });

    it('a 100 m hill reads about 100 m', () => {
      SEEDS.forEach((seed) => {
        const { summary } = simulate(climb, heightNoise, seed);
        expect(summary.elevGain).toBeGreaterThan(90);
        expect(summary.elevGain).toBeLessThan(125);
        expect(summary.elevLoss).toBeLessThan(25);
      });
    });

    it('four 25 m hills read about 100 m up and 100 m down', () => {
      SEEDS.forEach((seed) => {
        const { summary } = simulate(hills, heightNoise, seed);
        expect(summary.elevGain).toBeGreaterThan(70);
        expect(summary.elevGain).toBeLessThan(115);
        expect(summary.elevLoss).toBeGreaterThan(65);
        expect(summary.elevLoss).toBeLessThan(115);
      });
    });
  });
});

describe('when a program session counts', () => {
  const plan = [
    { type: 'run', seconds: 60 },
    { type: 'walk', seconds: 90 },
    { type: 'run', seconds: 50 },
  ]; // 200 seconds in all

  it('adds up the planned time, ignoring junk', () => {
    expect(plannedSeconds(plan)).toBe(200);
    expect(plannedSeconds([{ seconds: 60 }, { seconds: -5 }, {}, null, { seconds: 'x' }])).toBe(60);
    expect(plannedSeconds(null)).toBe(0);
    expect(plannedSeconds([])).toBe(0);
  });

  it('wants about four fifths of the plan', () => {
    expect(PROGRAM_CREDIT_FRACTION).toBe(0.8);
    expect(sessionCounts(plan, 159)).toBe(false);
    expect(sessionCounts(plan, 160)).toBe(true);
    expect(sessionCounts(plan, 200)).toBe(true);
    expect(sessionCounts(plan, 400)).toBe(true);
    expect(sessionCounts(plan, 0)).toBe(false);
  });

  it('never counts a session that has no plan', () => {
    expect(sessionCounts(null, 999)).toBe(false);
    expect(sessionCounts([], 999)).toBe(false);
  });

  it('is exact for a real 20 minute session', () => {
    const real = Array.from({ length: 16 }, (_, i) => ({ type: i % 2 ? 'walk' : 'run', seconds: i % 2 ? 90 : 60 }));
    expect(plannedSeconds(real)).toBe(1200);
    expect(sessionCounts(real, 959)).toBe(false);
    expect(sessionCounts(real, 960)).toBe(true);
  });
});
