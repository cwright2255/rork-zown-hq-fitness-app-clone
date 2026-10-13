import {
  OSM_PATH_PREFIX, OSM_RADIUS_M, MAX_OSM_PATHS, MIN_PATH_KM, JOIN_TOLERANCE_M,
  osmPathId, isOsmPathId, buildOverpassQuery, chainPieces, parseOverpassPaths, splitPaths,
} from '../lib/osmTrails';
import { distanceM } from '../lib/gpsFilter';

// A straight line of `n` points starting at [lat0, lon0], one step apart (0.001 degrees of latitude is about 111 m).
const line = (lat0, lon0, n, dLat = 0.001, dLon = 0) => Array.from({ length: n }, (_, i) => [lat0 + i * dLat, lon0 + i * dLon]);
// A way as Overpass sends it for `out tags geom`.
const way = (id, name, points, tags = {}) => ({
  type: 'way',
  id,
  bounds: { minlat: 0, minlon: 0, maxlat: 0, maxlon: 0 },
  geometry: points.map(([lat, lon]) => ({ lat, lon })),
  tags: { highway: 'path', ...(name === null ? {} : { name }), ...tags },
});
const answer = (...elements) => ({ version: 0.6, generator: 'Overpass API', elements });
const ORIGIN = { latitude: 40, longitude: -75 };

describe('path ids', () => {
  it('start with a prefix no TrailAPI map id has', () => {
    expect(OSM_PATH_PREFIX).toBe('osm-way-');
    expect(osmPathId(1234)).toBe('osm-way-1234');
    expect(isOsmPathId('osm-way-1234')).toBe(true);
  });

  it('are told apart from TrailAPI map ids, which are numbers or plain digits', () => {
    expect(isOsmPathId(11)).toBe(false);
    expect(isOsmPathId('11')).toBe(false);
    expect(isOsmPathId('osm-5')).toBe(false); // a trail id, not a path id
    expect(isOsmPathId(null)).toBe(false);
    expect(isOsmPathId(undefined)).toBe(false);
  });
});

describe('buildOverpassQuery', () => {
  it('asks for named footpaths, tracks and bridleways around the point, with their shape', () => {
    const q = buildOverpassQuery(39.9876543, -75.0123456, 2000);
    expect(q).toContain('[out:json]');
    expect(q).toContain('way(around:2000,39.987654,-75.012346)');
    expect(q).toContain('["highway"~"^(path|footway|track|bridleway)$"]');
    expect(q).toContain('["name"]');
    expect(q).toMatch(/out tags geom \d+;$/);
  });

  it('leaves out private ways, no-walking ways and the sidewalks beside roads', () => {
    const q = buildOverpassQuery(40, -75);
    expect(q).toContain('["access"!~"^(private|no)$"]');
    expect(q).toContain('["foot"!~"^(no|private)$"]');
    expect(q).toContain('["footway"!~"^(sidewalk|crossing|access_aisle)$"]');
  });

  it('looks 2 km around by default and rounds the radius to whole metres', () => {
    expect(OSM_RADIUS_M).toBe(2000);
    expect(buildOverpassQuery(40, -75)).toContain('around:2000,');
    expect(buildOverpassQuery(40, -75, 1500.6)).toContain('around:1501,');
  });
});

describe('chainPieces', () => {
  it('joins pieces that meet end to start', () => {
    const lines = chainPieces([
      { id: 1, points: line(40, -75, 3).map(([latitude, longitude]) => ({ latitude, longitude })) },
      { id: 2, points: line(40.002, -75, 3).map(([latitude, longitude]) => ({ latitude, longitude })) },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].ids).toEqual([1, 2]);
    expect(lines[0].points).toHaveLength(5); // the shared point once
    expect(lines[0].points[0].latitude).toBeCloseTo(40, 6);
    expect(lines[0].points[4].latitude).toBeCloseTo(40.004, 6);
  });

  const pts = (arr) => arr.map(([latitude, longitude]) => ({ latitude, longitude }));

  it('turns a piece around when it is drawn the other way', () => {
    const a = pts(line(40, -75, 3)); // north to 40.002
    const b = pts(line(40.002, -75, 3)).reverse(); // drawn from 40.004 back to 40.002
    const [joined] = chainPieces([{ id: 1, points: a }, { id: 2, points: b }]);
    expect(joined.points.map((p) => +p.latitude.toFixed(3))).toEqual([40, 40.001, 40.002, 40.003, 40.004]);
  });

  it('adds a piece in front, whichever way it is drawn', () => {
    const tail = pts(line(40.002, -75, 3));
    const frontForward = pts(line(40, -75, 3));
    const frontBackward = pts(line(40, -75, 3)).reverse();
    [frontForward, frontBackward].forEach((front) => {
      // the lower id is taken first, so the piece to add in front has the higher id
      const [joined] = chainPieces([{ id: 1, points: tail }, { id: 2, points: front }]);
      expect(joined.points.map((p) => +p.latitude.toFixed(3))).toEqual([40, 40.001, 40.002, 40.003, 40.004]);
      expect(joined.ids.slice().sort()).toEqual([1, 2]);
    });
  });

  it('joins a long chain of pieces given out of order', () => {
    const lines = chainPieces([
      { id: 30, points: pts(line(40.006, -75, 4)) },
      { id: 10, points: pts(line(40, -75, 4)) },
      { id: 20, points: pts(line(40.003, -75, 4)) },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].points).toHaveLength(10);
    expect(lines[0].ids.slice().sort((x, y) => x - y)).toEqual([10, 20, 30]);
  });

  it('keeps separate parts as separate lines', () => {
    const lines = chainPieces([
      { id: 1, points: pts(line(40, -75, 3)) },
      { id: 2, points: pts(line(41, -75, 3)) },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.ids)).toEqual([[1], [2]]);
  });

  it('treats points a hair apart as the same point, as OpenStreetMap shares one node', () => {
    const lines = chainPieces([
      { id: 1, points: pts([[40, -75], [40.001, -75]]) },
      { id: 2, points: pts([[40.00100000001, -75], [40.002, -75]]) },
    ]);
    expect(lines).toHaveLength(1);
  });

  it('joins pieces cut by a road crossing: ends a few metres apart', () => {
    expect(JOIN_TOLERANCE_M).toBe(15);
    const [joined, ...rest] = chainPieces([
      { id: 1, points: pts([[40, -75], [40.001, -75]]) },
      { id: 2, points: pts([[40.0011, -75], [40.002, -75]]) }, // 11 m on
    ]);
    expect(rest).toEqual([]);
    expect(joined.points).toHaveLength(4); // both ends of the gap are kept
  });

  it('does not join pieces that are further apart than that', () => {
    const lines = chainPieces([
      { id: 1, points: pts([[40, -75], [40.001, -75]]) },
      { id: 2, points: pts([[40.0013, -75], [40.002, -75]]) }, // 33 m on
    ]);
    expect(lines).toHaveLength(2);
  });

  it('can be told how big a gap to close', () => {
    const input = [
      { id: 1, points: pts([[40, -75], [40.001, -75]]) },
      { id: 2, points: pts([[40.0013, -75], [40.002, -75]]) },
    ];
    expect(chainPieces(input, { toleranceM: 50 })).toHaveLength(1);
    expect(chainPieces(input, { toleranceM: 0 })).toHaveLength(2);
  });

  it('joins across a gap whichever way the piece is drawn', () => {
    const a = pts([[40, -75], [40.001, -75]]);
    const b = pts([[40.0011, -75], [40.002, -75]]);
    [b, b.slice().reverse()].forEach((second) => {
      const [joined] = chainPieces([{ id: 1, points: a }, { id: 2, points: second }]);
      expect(joined.points.map((p) => +p.latitude.toFixed(4))).toEqual([40, 40.001, 40.0011, 40.002]);
    });
    const front = pts([[39.999, -75], [40.001, -75]]); // ends 11 m short of the start of the piece below
    [front, front.slice().reverse()].forEach((before) => {
      const [joined] = chainPieces([{ id: 1, points: b }, { id: 2, points: before }]);
      expect(joined.points.map((p) => +p.latitude.toFixed(4))).toEqual([39.999, 40.001, 40.0011, 40.002]);
    });
  });

  it('gives nothing for nothing', () => {
    expect(chainPieces([])).toEqual([]);
  });

  it('does not change the pieces it is given', () => {
    const a = pts(line(40, -75, 3));
    const b = pts(line(40.002, -75, 3)).reverse();
    const input = [{ id: 1, points: a }, { id: 2, points: b }];
    chainPieces(input);
    expect(a).toHaveLength(3);
    expect(b[0].latitude).toBeCloseTo(40.004, 6);
    expect(input).toHaveLength(2);
  });
});

describe('parseOverpassPaths', () => {
  it('turns a named way into a path with its line, length and no heights', () => {
    const [path] = parseOverpassPaths(answer(way(500, 'Blue Trail', line(40, -75, 6))), { origin: ORIGIN });
    expect(path.id).toBe('osm-way-500');
    expect(path.name).toBe('Blue Trail');
    expect(path.route.coordinates).toHaveLength(6);
    expect(path.route.coordinates[0]).toEqual({ latitude: 40, longitude: -75 });
    expect(path.route.distanceKm).toBe(0.56); // 5 steps of about 111 m, to the nearest 10 m
    expect(path.route.elevationGainM).toBeNull();
    expect(path.route.elevationProfile).toBeNull();
    expect(path.nearestM).toBe(0);
  });

  it('joins the pieces of one trail into one path, named by the trail', () => {
    const paths = parseOverpassPaths(answer(
      way(11, 'Red Trail', line(40, -75, 4)),
      way(12, 'Red Trail', line(40.003, -75, 4)),
      way(13, 'Red Trail', line(40.006, -75, 4)),
    ), { origin: ORIGIN });
    expect(paths).toHaveLength(1);
    expect(paths[0].route.coordinates).toHaveLength(10);
    expect(paths[0].route.distanceKm).toBeCloseTo(1.0, 1);
    expect(paths[0].id).toBe('osm-way-11'); // the lowest piece, so the id is the same each time
  });

  it('draws the line the same way round whatever order the pieces come in, even when some are drawn backwards', () => {
    const pieces = [
      way(11, 'Red Trail', line(40, -75, 4)), // north to 40.003
      way(12, 'Red Trail', line(40.003, -75, 4).reverse()), // drawn from 40.006 back to 40.003
      way(13, 'Red Trail', line(40.006, -75, 4).reverse()), // drawn from 40.009 back to 40.006
    ];
    const forward = parseOverpassPaths(answer(...pieces), { origin: ORIGIN });
    const backward = parseOverpassPaths(answer(...pieces.slice().reverse()), { origin: ORIGIN });
    const lats = (paths) => paths[0].route.coordinates.map((p) => +p.latitude.toFixed(3));
    expect(lats(forward)).toEqual([40, 40.001, 40.002, 40.003, 40.004, 40.005, 40.006, 40.007, 40.008, 40.009]);
    expect(lats(backward)).toEqual(lats(forward));
  });

  it('gives the same id whatever order the pieces come in', () => {
    const pieces = [
      way(11, 'Red Trail', line(40, -75, 4)),
      way(12, 'Red Trail', line(40.003, -75, 4)),
      way(13, 'Red Trail', line(40.006, -75, 4)),
    ];
    const forward = parseOverpassPaths(answer(...pieces), { origin: ORIGIN });
    const backward = parseOverpassPaths(answer(...pieces.slice().reverse()), { origin: ORIGIN });
    expect(backward.map((p) => p.id)).toEqual(forward.map((p) => p.id));
    expect(backward[0].route.coordinates).toEqual(forward[0].route.coordinates);
  });

  it('takes pieces with the same name in different letters as one trail', () => {
    const paths = parseOverpassPaths(answer(
      way(1, 'Pine Loop', line(40, -75, 4)),
      way(2, 'pine loop ', line(40.003, -75, 4)),
    ), { origin: ORIGIN });
    expect(paths).toHaveLength(1);
    expect(paths[0].name).toBe('Pine Loop');
  });

  it('makes two paths of a trail that is in two separate parts, and numbers the second', () => {
    const paths = parseOverpassPaths(answer(
      way(1, 'Ridge Trail', line(40, -75, 5)),
      way(2, 'Ridge Trail', line(40.02, -75, 5)),
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['Ridge Trail', 'Ridge Trail 2']);
    expect(paths[0].id).not.toBe(paths[1].id);
  });

  it('leaves out bits shorter than a quarter of a kilometre', () => {
    expect(MIN_PATH_KM).toBe(0.25);
    const paths = parseOverpassPaths(answer(
      way(1, 'Parking Link', line(40, -75, 2)), // 111 m
      way(2, 'Real Trail', line(40.01, -75, 4)), // 333 m
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['Real Trail']);
  });

  it('keeps a bit that is exactly the shortest allowed', () => {
    const two = [[40, -75], [40.002, -75]];
    const exactKm = distanceM({ latitude: 40, longitude: -75 }, { latitude: 40.002, longitude: -75 }) / 1000;
    expect(parseOverpassPaths(answer(way(1, 'Exact', two)), { origin: ORIGIN, minKm: exactKm })).toHaveLength(1);
  });

  it('does not take a single point for a path, even when no length is too short', () => {
    expect(parseOverpassPaths(answer(way(1, 'Dot', [[40, -75]])), { origin: ORIGIN, minKm: 0 })).toEqual([]);
  });

  it('can be asked for shorter bits or longer ones', () => {
    const data = answer(way(1, 'Short', line(40, -75, 2)));
    expect(parseOverpassPaths(data, { origin: ORIGIN, minKm: 0.05 })).toHaveLength(1);
    expect(parseOverpassPaths(data, { origin: ORIGIN, minKm: 0.2 })).toHaveLength(0);
  });

  it('lists the path nearest the trail point first, and says how near', () => {
    const paths = parseOverpassPaths(answer(
      way(1, 'Far Trail', line(40.01, -75, 6)),
      way(2, 'Near Trail', line(40.0005, -75, 6)),
      way(3, 'Middle Trail', line(40.005, -75, 6)),
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['Near Trail', 'Middle Trail', 'Far Trail']);
    expect(paths[0].nearestM).toBeCloseTo(distanceM(ORIGIN, { latitude: 40.0005, longitude: -75 }), 0);
    expect(paths[0].nearestM).toBeLessThan(paths[1].nearestM);
  });

  it('puts the longer one first when two are equally near', () => {
    // both start at the trail point itself
    const paths = parseOverpassPaths(answer(
      way(1, 'Short', line(40, -75, 4)),
      way(2, 'Long', line(40, -75, 9)),
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['Long', 'Short']);
  });

  it('offers at most eight paths, and a different number when asked', () => {
    expect(MAX_OSM_PATHS).toBe(8);
    const many = Array.from({ length: 12 }, (_, i) => way(i + 1, `Trail ${i + 1}`, line(40 + i * 0.01, -75, 4)));
    expect(parseOverpassPaths(answer(...many), { origin: ORIGIN })).toHaveLength(8);
    expect(parseOverpassPaths(answer(...many), { origin: ORIGIN, max: 3 })).toHaveLength(3);
    // and the ones kept are the nearest
    expect(parseOverpassPaths(answer(...many), { origin: ORIGIN, max: 3 }).map((p) => p.name)).toEqual(['Trail 1', 'Trail 2', 'Trail 3']);
  });

  it('thins a line with very many points to 800, keeping the first and the last', () => {
    const dense = line(40, -75, 3000, 0.00001, 0);
    const [path] = parseOverpassPaths(answer(way(1, 'Dense', dense)), { origin: ORIGIN, minKm: 0 });
    expect(path.route.coordinates).toHaveLength(800);
    expect(path.route.coordinates[0]).toEqual({ latitude: 40, longitude: -75 });
    expect(path.route.coordinates[799].latitude).toBeCloseTo(40 + 2999 * 0.00001, 6);
    // and the length is of the whole line, not the thinned one
    expect(path.route.distanceKm).toBeCloseTo(3.33, 1);
  });

  it('skips ways with no name, a blank name or no usable shape', () => {
    const paths = parseOverpassPaths(answer(
      way(1, null, line(40, -75, 6)),
      way(2, '   ', line(40, -75, 6)),
      way(3, 'One Point', line(40, -75, 1)),
      { type: 'way', id: 4, tags: { name: 'No Shape', highway: 'path' } },
      { type: 'way', id: 5, tags: { name: 'Bad Shape', highway: 'path' }, geometry: [{ lat: 40 }, { lon: -75 }, null] },
      way(6, 'Good Trail', line(40, -75, 6)),
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['Good Trail']);
  });

  it('skips points without coordinates inside a way and keeps the rest', () => {
    const w = way(1, 'Gappy', line(40, -75, 6));
    w.geometry.splice(2, 0, null, { lat: 'x', lon: 'y' });
    const [path] = parseOverpassPaths(answer(w), { origin: ORIGIN });
    expect(path.route.coordinates).toHaveLength(6);
  });

  it('ignores things that are not ways', () => {
    const paths = parseOverpassPaths(answer(
      { type: 'node', id: 1, lat: 40, lon: -75, tags: { name: 'A Node' } },
      { type: 'relation', id: 2, tags: { name: 'A Relation' }, members: [] },
      { type: 'relation', id: 4, tags: { name: 'Shaped Relation' }, geometry: line(40, -75, 6).map(([lat, lon]) => ({ lat, lon })) },
      { type: 'node', id: 5, tags: { name: 'Shaped Node' }, geometry: line(40, -75, 6).map(([lat, lon]) => ({ lat, lon })) },
      way(3, 'A Way', line(40, -75, 6)),
    ), { origin: ORIGIN });
    expect(paths.map((p) => p.name)).toEqual(['A Way']);
  });

  it('gives no paths for an answer it cannot read', () => {
    [undefined, null, {}, { elements: null }, { elements: 'no' }, 'text', 5, { elements: [] }, { elements: [null, 3, 'x'] }].forEach((bad) => {
      expect(parseOverpassPaths(bad, { origin: ORIGIN })).toEqual([]);
    });
  });

  it('works without a point to measure from, keeping the answer in order of length', () => {
    const paths = parseOverpassPaths(answer(
      way(1, 'Shorter', line(40, -75, 4)),
      way(2, 'Longer', line(41, -75, 8)),
    ));
    expect(paths.map((p) => p.name)).toEqual(['Longer', 'Shorter']);
    expect(paths.every((p) => p.nearestM === 0)).toBe(true);
  });
});

describe('splitPaths', () => {
  it('gives the list for the picker, with lengths, and the lines by id', () => {
    const paths = parseOverpassPaths(answer(
      way(1, 'Blue Trail', line(40, -75, 6)),
      way(2, 'Red Trail', line(40.01, -75, 6)),
    ), { origin: ORIGIN });
    const { maps, routes } = splitPaths(paths);
    expect(maps).toEqual([
      { id: 'osm-way-1', name: 'Blue Trail', distanceKm: paths[0].route.distanceKm },
      { id: 'osm-way-2', name: 'Red Trail', distanceKm: paths[1].route.distanceKm },
    ]);
    expect(Object.keys(routes)).toEqual(['osm-way-1', 'osm-way-2']);
    expect(routes['osm-way-2']).toBe(paths[1].route);
  });

  it('gives empty lists for nothing', () => {
    expect(splitPaths([])).toEqual({ maps: [], routes: {} });
    expect(splitPaths(undefined)).toEqual({ maps: [], routes: {} });
  });
});
