import {
  JOURNEYS, MILESTONE_PERCENTS, journeyById, milestonesFor, isActiveRecord, journeyProgress, journeyXp, journeyLength, journeySubtitle,
} from '../lib/virtualJourneys';

// A 34 km route of our own, so the sums below do not move when a real route's length does.
const canyon = {
  id: 'test-route', title: 'Test route', distanceKm: 34, region: 'Nowhere', blurb: 'A route for testing.',
  landmarks: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
};
const rim = journeyById('grand-canyon-rim'); // 21 km
const camino = journeyById('camino-frances'); // 780 km

describe('the catalogue', () => {
  it('has nine routes, shortest first, each with what a card needs', () => {
    expect(JOURNEYS).toHaveLength(9);
    expect(JOURNEYS.map((j) => j.distanceKm)).toEqual([21, 42, 43, 104, 135, 154, 170, 340, 780]);
    for (const j of JOURNEYS) {
      expect(typeof j.id).toBe('string');
      expect(j.title.length).toBeGreaterThan(0);
      expect(j.region.length).toBeGreaterThan(0);
      expect(j.blurb.length).toBeGreaterThan(0);
      expect(Number.isInteger(j.distanceKm)).toBe(true);
    }
  });

  it('names a place for each milestone on every route, none twice on a route', () => {
    for (const j of JOURNEYS) {
      expect(j.landmarks).toHaveLength(MILESTONE_PERCENTS.length);
      for (const place of j.landmarks) expect(place.trim().length).toBeGreaterThan(0);
      expect(new Set(j.landmarks).size).toBe(j.landmarks.length);
    }
  });

  it('ends every route at a place that says where it ends', () => {
    expect(JOURNEYS.map((j) => j.landmarks[3])).toEqual([
      'South Kaibab Trailhead', 'Panathenaic Stadium', 'Machu Picchu', 'Twelve Apostles', 'Bowness-on-Solway',
      'Fort William', 'Les Houches', 'Mount Whitney', 'Santiago de Compostela',
    ]);
  });

  it('keeps the ids the store has always used, and no id twice', () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['grand-canyon-rim', 'hadrians-wall', 'camino-frances', 'john-muir-trail']));
    expect(journeyById('grand-canyon-rim')).toMatchObject({ title: 'Grand Canyon Rim Trail', distanceKm: 21, region: 'Arizona, USA' });
    expect(journeyById('marathon-to-athens')).toMatchObject({ title: 'Marathon to Athens', distanceKm: 42 });
  });

  it('finds a route by id, and nothing for anything else', () => {
    expect(journeyById('inca-trail').title).toBe('Inca Trail');
    expect(journeyById('nowhere')).toBeNull();
    expect(journeyById(undefined)).toBeNull();
    expect(journeyById(['inca-trail'])).toBeNull();
  });
});

describe('milestones', () => {
  it('are a quarter, half, three quarters and the finish', () => {
    expect(MILESTONE_PERCENTS).toEqual([25, 50, 75, 100]);
    expect(milestonesFor(canyon)).toEqual([
      { percent: 25, name: 'A quarter of the way', atKm: 8.5, place: 'near Alpha' },
      { percent: 50, name: 'Halfway', atKm: 17, place: 'near Bravo' },
      { percent: 75, name: 'Three quarters', atKm: 25.5, place: 'near Charlie' },
      { percent: 100, name: 'The finish', atKm: 34, place: 'Delta' },
    ]);
    expect(milestonesFor(camino).map((m) => m.atKm)).toEqual([195, 390, 585, 780]);
  });

  it('say where on a real route they are: near a place, and the finish at the place itself', () => {
    expect(milestonesFor(rim).map((m) => [m.atKm, m.place])).toEqual([
      [5.25, 'near Hopi Point'], [10.5, 'near Trailview Overlook'], [15.75, 'near Yavapai Point'], [21, 'South Kaibab Trailhead'],
    ]);
    expect(milestonesFor(camino).map((m) => m.place)).toEqual([
      'near Santo Domingo de la Calzada', 'near Frómista', 'near Ponferrada', 'Santiago de Compostela',
    ]);
  });

  it('are none for no route', () => {
    expect(milestonesFor(null)).toEqual([]);
    expect(milestonesFor(undefined)).toEqual([]);
  });
});

describe('journeyProgress', () => {
  it('is nothing for a person who has not joined', () => {
    expect(journeyProgress(canyon, undefined)).toEqual({
      joined: false, coveredKm: 0, leftKm: 34, fraction: 0, percent: 0, reached: 0, completed: false,
      next: { percent: 25, name: 'A quarter of the way', atKm: 8.5, place: 'near Alpha' },
    });
    expect(journeyProgress(canyon, null).joined).toBe(false);
  });

  it('is nothing at all without a route', () => {
    expect(journeyProgress(null, { distanceKm: 5 })).toMatchObject({ joined: false, coveredKm: 0, leftKm: 0, fraction: 0, completed: false, next: null });
  });

  it('starts at zero when joined, with the first milestone next', () => {
    const p = journeyProgress(canyon, { distanceKm: 0, completedAt: null });
    expect(p).toMatchObject({ joined: true, coveredKm: 0, leftKm: 34, fraction: 0, percent: 0, reached: 0, completed: false });
    expect(p.next.percent).toBe(25);
  });

  it('counts a milestone as reached at exactly its distance', () => {
    expect(journeyProgress(canyon, { distanceKm: 8.4 }).reached).toBe(0);
    expect(journeyProgress(canyon, { distanceKm: 8.5 })).toMatchObject({ reached: 1, percent: 25 });
    expect(journeyProgress(canyon, { distanceKm: 8.5 }).next.percent).toBe(50);
    expect(journeyProgress(canyon, { distanceKm: 17 }).reached).toBe(2);
    expect(journeyProgress(canyon, { distanceKm: 25.5 }).reached).toBe(3);
    expect(journeyProgress(canyon, { distanceKm: 25.5 }).next).toEqual({ percent: 100, name: 'The finish', atKm: 34, place: 'Delta' });
  });

  it('reports whole per cent, and never 100 until the route is done', () => {
    expect(journeyProgress(canyon, { distanceKm: 12 })).toMatchObject({ percent: 35, leftKm: 22 });
    expect(journeyProgress(canyon, { distanceKm: 12 }).fraction).toBeCloseTo(12 / 34, 10);
    expect(journeyProgress(canyon, { distanceKm: 33.99 }).percent).toBe(99);
    expect(journeyProgress(canyon, { distanceKm: 33.99 }).completed).toBe(false);
  });

  it('rounds per cent down, not to the nearest', () => {
    expect(journeyProgress(canyon, { distanceKm: 20 }).percent).toBe(58); // 58.8
    expect(journeyProgress(journeyById('camino-frances'), { distanceKm: 779.9 }).percent).toBe(99); // 99.99
  });

  it('is finished at the full distance, with nothing left and no next milestone', () => {
    expect(journeyProgress(canyon, { distanceKm: 34 })).toEqual({
      joined: true, coveredKm: 34, leftKm: 0, fraction: 1, percent: 100, reached: 4, completed: true, next: null,
    });
  });

  it('is finished by distance alone once the record reaches the length of the route', () => {
    expect(journeyProgress(canyon, { distanceKm: 90 })).toEqual({
      joined: true, coveredKm: 34, leftKm: 0, fraction: 1, percent: 100, reached: 4, completed: true, next: null,
    });
  });

  it('stays at the length of the route however far the record says', () => {
    expect(journeyProgress(canyon, { distanceKm: 90, completedAt: '2026-10-14T10:00:00Z' })).toMatchObject({ coveredKm: 34, fraction: 1, leftKm: 0, completed: true });
  });

  it('is finished when the record says so, even with a shorter distance', () => {
    expect(journeyProgress(canyon, { distanceKm: 10, completedAt: '2026-10-14T10:00:00Z' })).toMatchObject({
      coveredKm: 34, percent: 100, reached: 4, completed: true, next: null,
    });
  });

  it('treats a distance that is not a number, or is negative, as nothing', () => {
    expect(journeyProgress(canyon, { distanceKm: 'far' })).toMatchObject({ joined: true, coveredKm: 0, completed: false });
    expect(journeyProgress(canyon, { distanceKm: NaN }).coveredKm).toBe(0);
    expect(journeyProgress(canyon, { distanceKm: -5 }).coveredKm).toBe(0);
    expect(journeyProgress(canyon, { distanceKm: Infinity })).toMatchObject({ coveredKm: 0, completed: false });
    expect(journeyProgress(canyon, {}).coveredKm).toBe(0);
  });
});

describe('a journey that was left', () => {
  const joinedAt = '2026-10-01T10:00:00.000Z';
  const leftAt = '2026-10-05T10:00:00.000Z';
  const again = '2026-10-09T10:00:00.000Z';

  it('is active when it was never left, or joined again after being left', () => {
    expect(isActiveRecord({ startedAt: joinedAt, distanceKm: 3 })).toBe(true);
    expect(isActiveRecord({ startedAt: joinedAt, distanceKm: 3, leftAt: null })).toBe(true);
    expect(isActiveRecord({ startedAt: again, distanceKm: 0, leftAt })).toBe(true);
  });

  it('is not active once it has been left, or when there is no record', () => {
    expect(isActiveRecord({ startedAt: joinedAt, distanceKm: 0, leftAt })).toBe(false);
    expect(isActiveRecord({ startedAt: leftAt, distanceKm: 0, leftAt })).toBe(false);
    expect(isActiveRecord(undefined)).toBe(false);
    expect(isActiveRecord(null)).toBe(false);
  });

  it('is progress like one never joined', () => {
    expect(journeyProgress(canyon, { startedAt: joinedAt, distanceKm: 20, completedAt: null, leftAt })).toEqual(journeyProgress(canyon, undefined));
  });

  it('is progress from nothing once joined again', () => {
    expect(journeyProgress(canyon, { startedAt: again, distanceKm: 0, completedAt: null, leftAt })).toMatchObject({ joined: true, coveredKm: 0 });
    expect(journeyProgress(canyon, { startedAt: again, distanceKm: 17, completedAt: null, leftAt })).toMatchObject({ joined: true, coveredKm: 17, reached: 2 });
  });
});

describe('journeyXp', () => {
  it('is more for a longer route', () => {
    expect(journeyXp(34)).toBe(500);
    expect(journeyXp(99)).toBe(500);
    expect(journeyXp(100)).toBe(1000);
    expect(journeyXp(399)).toBe(1000);
    expect(journeyXp(400)).toBe(2000);
    expect(journeyXp(780)).toBe(2000);
  });

  it('is one of three amounts for every route', () => {
    expect(JOURNEYS.map((j) => journeyXp(j.distanceKm))).toEqual([500, 500, 500, 1000, 1000, 1000, 1000, 1000, 2000]);
  });
});

describe('how a route is written', () => {
  it('is whole kilometres for the metric setting', () => {
    expect(journeyLength(34, 'metric')).toBe('34 km');
    expect(journeyLength(780, 'metric')).toBe('780 km');
  });

  it('is miles for the imperial setting: a decimal when short, whole when long', () => {
    expect(journeyLength(34, 'imperial')).toBe('21.1 mi');
    expect(journeyLength(42, 'imperial')).toBe('26.1 mi');
    expect(journeyLength(340, 'imperial')).toBe('211 mi');
    expect(journeyLength(780, 'imperial')).toBe('485 mi');
  });

  it('is kilometres when there is no setting', () => {
    expect(journeyLength(34)).toBe('34 km');
  });

  it('has a line for a card', () => {
    expect(journeySubtitle(rim, 'metric')).toBe('21 km · 4 milestones');
    expect(journeySubtitle(rim, 'imperial')).toBe('13.0 mi · 4 milestones');
    expect(journeySubtitle(camino, 'imperial')).toBe('485 mi · 4 milestones');
  });
});
