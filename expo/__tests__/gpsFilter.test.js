import {
  distanceM, normalizeFix, kalmanStep, windowSpeed, updateElevation, gpsQuality,
  MAX_ACCURACY_M, ALT_STEP_M,
} from '../lib/gpsFilter';

const loc = (coords = {}, over = {}) => ({
  timestamp: 1000,
  coords: {
    latitude: 40.7, longitude: -74, accuracy: 5, altitude: 30, altitudeAccuracy: 4, speed: 2, heading: 0, ...coords,
  },
  ...over,
});

// Small seeded random numbers so the noise tests give the same result every run.
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

describe('distanceM', () => {
  it('is about 111 km for one degree of latitude', () => {
    expect(Math.abs(distanceM({ lat: 40, lng: -74 }, { lat: 41, lng: -74 }) - 111195)).toBeLessThan(100);
  });

  it('is zero for the same point and takes either field naming', () => {
    expect(distanceM({ lat: 40, lng: -74 }, { latitude: 40, longitude: -74 })).toBe(0);
  });

  it('shrinks east-west distances with latitude', () => {
    const equator = distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const north = distanceM({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(north / equator).toBeGreaterThan(0.49);
    expect(north / equator).toBeLessThan(0.51);
  });
});

describe('gpsQuality', () => {
  it('rates accuracy in metres', () => {
    expect(gpsQuality(5)).toBe('good');
    expect(gpsQuality(20)).toBe('fair');
    expect(gpsQuality(60)).toBe('weak');
    expect(gpsQuality(-1)).toBe('weak');
    expect(gpsQuality(undefined)).toBe('weak');
  });
});

describe('normalizeFix', () => {
  it('flattens a good reading', () => {
    expect(normalizeFix(loc())).toEqual({
      lat: 40.7, lng: -74, t: 1000, acc: 5, speed: 2, alt: 30, altAcc: 4,
    });
  });

  it('rejects readings that cannot be used', () => {
    expect(normalizeFix(null)).toBeNull();
    expect(normalizeFix({ timestamp: 1 })).toBeNull();
    expect(normalizeFix(loc({ latitude: NaN }))).toBeNull();
    expect(normalizeFix(loc({ latitude: 95 }))).toBeNull();
    expect(normalizeFix(loc({ longitude: -200 }))).toBeNull();
    expect(normalizeFix(loc({ latitude: 0, longitude: 0 }))).toBeNull();
    expect(normalizeFix(loc({}, { timestamp: undefined }))).toBeNull();
  });

  it('treats a negative accuracy (iOS "invalid") as no reading', () => {
    expect(normalizeFix(loc({ accuracy: -1 }))).toBeNull();
  });

  it('never trusts a reading to be better than 3 m, and guesses when accuracy is missing', () => {
    expect(normalizeFix(loc({ accuracy: 0.5 })).acc).toBe(3);
    expect(normalizeFix(loc({ accuracy: undefined })).acc).toBe(15);
  });

  it('reports unknown speed as null', () => {
    expect(normalizeFix(loc({ speed: -1 })).speed).toBeNull();
    expect(normalizeFix(loc({ speed: null })).speed).toBeNull();
    expect(normalizeFix(loc({ speed: 0 })).speed).toBe(0);
  });

  it('ignores heights that are invalid or too vague', () => {
    expect(normalizeFix(loc({ altitudeAccuracy: -1 })).alt).toBeNull();
    expect(normalizeFix(loc({ altitudeAccuracy: MAX_ACCURACY_M })).alt).toBeNull();
    expect(normalizeFix(loc({ altitude: undefined })).alt).toBeNull();
    // Android sends 0 when it has no height at all
    expect(normalizeFix(loc({ altitude: 0, altitudeAccuracy: null })).alt).toBeNull();
    expect(normalizeFix(loc({ altitude: 0, altitudeAccuracy: 3 })).alt).toBe(0);
  });
});

describe('kalmanStep', () => {
  it('starts at the first reading', () => {
    const kf = kalmanStep(null, 40, -74, 5, 0);
    expect(kf.lat).toBe(40);
    expect(kf.variance).toBe(25);
  });

  it('moves further toward an accurate reading than a vague one', () => {
    const start = kalmanStep(null, 40, -74, 5, 0);
    const accurate = kalmanStep(start, 40.001, -74, 3, 1000);
    const vague = kalmanStep(start, 40.001, -74, 30, 1000);
    expect(accurate.lat - 40).toBeGreaterThan(vague.lat - 40);
    expect(vague.lat - 40).toBeGreaterThan(0);
  });

  it('trusts a new reading more after a long silence', () => {
    const start = kalmanStep(null, 40, -74, 5, 0);
    const soon = kalmanStep(start, 40.001, -74, 5, 1000);
    const later = kalmanStep(start, 40.001, -74, 5, 20000);
    expect(later.lat - 40).toBeGreaterThan(soon.lat - 40);
  });

  it('starts afresh after a long silence instead of dragging behind', () => {
    const start = kalmanStep(null, 40, -74, 5, 0);
    const after = kalmanStep(start, 40.02, -74, 5, 5 * 60 * 1000);
    expect(after.lat).toBe(40.02);
  });

  it('turns jittery readings of one spot into a steadier track', () => {
    const r = rng(7);
    const mPerDeg = 111320;
    let kf = null;
    const rawErr = [];
    const smoothErr = [];
    for (let i = 0; i < 300; i += 1) {
      const dx = r.gauss() * 4;
      const dy = r.gauss() * 4;
      kf = kalmanStep(kf, 40 + dy / mPerDeg, -74 + dx / (mPerDeg * Math.cos(40 * Math.PI / 180)), 5, i * 1000);
      if (i > 10) {
        rawErr.push(Math.hypot(dx, dy));
        smoothErr.push(distanceM({ lat: 40, lng: -74 }, kf));
      }
    }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(smoothErr)).toBeLessThan(mean(rawErr) * 0.75);
  });
});

describe('windowSpeed', () => {
  const at = (t, metres) => ({ t, lat: 40, lng: -74 + metres / (111320 * Math.cos(40 * Math.PI / 180)) });

  it('says nothing from too few or too short a stretch of readings', () => {
    expect(windowSpeed([])).toBeNull();
    expect(windowSpeed([at(0, 0), at(1000, 2)])).toBeNull();
    expect(windowSpeed([at(0, 0), at(1000, 2), at(2000, 4)])).toBeNull();
  });

  it('is distance over time', () => {
    const v = windowSpeed([at(0, 0), at(2500, 5), at(5000, 10)]);
    expect(v).toBeGreaterThan(1.99);
    expect(v).toBeLessThan(2.01);
  });
});

describe('updateElevation', () => {
  const feed = (alts, { counting = true, from = null, dt = 1000 } = {}) => {
    let el = from;
    alts.forEach((a, i) => { el = updateElevation(el, a, (from ? from.t : 0) + (i + 1) * dt, counting); });
    return el;
  };

  it('keeps the old result when there is no height', () => {
    const el = updateElevation(null, 50, 0);
    expect(updateElevation(el, null, 1000)).toBe(el);
    expect(updateElevation(null, null, 0)).toBeNull();
  });

  it('counts nothing for wobble smaller than the step', () => {
    const r = rng(3);
    const alts = Array.from({ length: 600 }, () => 50 + r.gauss() * 1.5);
    const el = feed(alts, { from: updateElevation(null, 50, 0) });
    expect(el.gain).toBe(0);
    expect(el.loss).toBe(0);
  });

  it('counts a real climb, including the part still in progress', () => {
    const alts = Array.from({ length: 400 }, (_, i) => 50 + Math.min(i, 200) * 0.2); // +40 m over 200 s, then flat
    const el = feed(alts, { from: updateElevation(null, 50, 0) });
    expect(el.gain).toBeGreaterThan(40 - ALT_STEP_M - 4);
    expect(el.gain).toBeLessThan(44);
    expect(el.loss).toBe(0);
  });

  it('counts a descent the same way', () => {
    const alts = Array.from({ length: 400 }, (_, i) => 100 - Math.min(i, 200) * 0.2);
    const el = feed(alts, { from: updateElevation(null, 100, 0) });
    expect(el.loss).toBeGreaterThan(40 - ALT_STEP_M - 4);
    expect(el.gain).toBe(0);
  });

  it('counts up and down hills separately', () => {
    const alts = [];
    for (let h = 0; h < 3; h += 1) {
      for (let i = 0; i < 150; i += 1) alts.push(50 + i * 0.2); // +30
      for (let i = 0; i < 150; i += 1) alts.push(80 - i * 0.2); // -30
    }
    const el = feed(alts, { from: updateElevation(null, 50, 0) });
    expect(el.gain).toBeGreaterThan(60);
    expect(el.gain).toBeLessThan(95);
    expect(el.loss).toBeGreaterThan(60);
  });

  it('adds nothing for height changes while not counting', () => {
    let el = feed(Array.from({ length: 60 }, () => 50), { from: updateElevation(null, 50, 0) });
    el = feed(Array.from({ length: 200 }, () => 150), { from: el, counting: false });
    el = feed(Array.from({ length: 200 }, () => 150), { from: el, counting: true });
    expect(el.gain).toBe(0);
    expect(el.loss).toBe(0);
  });

  it('keeps what was counted when it stops counting', () => {
    let el = feed(Array.from({ length: 300 }, (_, i) => 50 + i * 0.2), { from: updateElevation(null, 50, 0) });
    const before = el.gain;
    expect(before).toBeGreaterThan(30);
    el = feed(Array.from({ length: 50 }, () => 110), { from: el, counting: false });
    expect(el.gain).toBeGreaterThanOrEqual(before);
  });
});
