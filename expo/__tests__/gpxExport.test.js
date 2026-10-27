// Writing a route as a GPX file (lib/gpxExport.js).

import { xmlEscape, buildGpx, gpxFileName, hikeGpxFile, trailGpxFile } from '@/lib/gpxExport';
import { parseGpxToRoute } from '@/lib/parseGpx';
import { buildSavedHike } from '@/lib/hikeLog';

const A = { latitude: 40.7128, longitude: -74.006 };
const B = { latitude: 40.7138, longitude: -74.005 };
const C = { latitude: 40.7148, longitude: -74.004 };

// A route walked from (40.70, -74.00) east, as a flat [lat, lng, ...] track.
const flatTrack = (n) => {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(40.7 + i * 0.0001, -74 + i * 0.0002);
  return out;
};

const savedHike = (over = {}) => ({
  ...buildSavedHike(
    {
      trailName: 'Wharton State Forest',
      pathName: 'Batsto Loop',
      distanceKm: 4.25,
      durationSeconds: 5025,
      elevationGainM: 63,
      startTime: new Date(2026, 9, 9, 8, 15).toISOString(),
      track: flatTrack(20),
    },
    { now: Date.UTC(2026, 9, 9, 18, 0, 0) },
  ),
  ...over,
});

describe('xmlEscape', () => {
  it('escapes the five characters XML cares about', () => {
    expect(xmlEscape(`Tom & "Jerry's" <trail>`)).toBe('Tom &amp; &quot;Jerry&apos;s&quot; &lt;trail&gt;');
  });

  it('escapes the ampersand first, so nothing is escaped twice', () => {
    expect(xmlEscape('a < b')).toBe('a &lt; b');
    expect(xmlEscape('&lt;')).toBe('&amp;lt;');
  });

  it('removes characters XML does not allow, and keeps tabs and new lines', () => {
    expect(xmlEscape('a\u0000b\u0008c\u000Bd\u000Ce\u001Ff')).toBe('abcdef');
    expect(xmlEscape('a\u000Eb\uFFFEc\uFFFFd\u0007e')).toBe('abcde');
    expect(xmlEscape('a\tb\nc\rd')).toBe('a\tb\nc\rd');
  });

  it('keeps accents, other alphabets and emoji', () => {
    const boot = '\u{1F97E}';
    expect(xmlEscape(`Café Zürich 山 ${boot}`)).toBe(`Café Zürich 山 ${boot}`);
  });

  it('turns nothing into an empty string and numbers into text', () => {
    expect(xmlEscape(undefined)).toBe('');
    expect(xmlEscape(null)).toBe('');
    expect(xmlEscape(0)).toBe('0');
    expect(xmlEscape(12.5)).toBe('12.5');
  });
});

describe('buildGpx', () => {
  it('writes a GPX 1.1 file with one track and one segment', () => {
    const xml = buildGpx({ name: 'Ridge', points: [A, B, C] });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Zown HQ"')).toBe(true);
    expect(xml).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(xml.trimEnd().endsWith('</gpx>')).toBe(true);
    expect(xml.endsWith('\n')).toBe(true);
    expect(xml.match(/<trk>/g)).toHaveLength(1);
    expect(xml.match(/<trkseg>/g)).toHaveLength(1);
    expect(xml.match(/<\/trkseg>/g)).toHaveLength(1);
    expect(xml.match(/<trkpt /g)).toHaveLength(3);
  });

  it('puts the name in the file details and on the track', () => {
    const xml = buildGpx({ name: 'Ridge', points: [A, B] });
    expect(xml).toContain('<metadata>\n    <name>Ridge</name>');
    expect(xml).toContain('<trk>\n    <name>Ridge</name>');
  });

  it('calls it Route when there is no name', () => {
    expect(buildGpx({ points: [A, B] })).toContain('<name>Route</name>');
    expect(buildGpx({ name: '', points: [A, B] })).toContain('<name>Route</name>');
  });

  it('escapes the name and the description', () => {
    const xml = buildGpx({ name: 'Bear & <Fox>', description: 'Say "hi"', points: [A, B] });
    expect(xml).toContain('<name>Bear &amp; &lt;Fox&gt;</name>');
    expect(xml).toContain('<desc>Say &quot;hi&quot;</desc>');
    expect(xml).not.toContain('<Fox>');
  });

  it('adds the description to the file details and the track, only when there is one', () => {
    const withDesc = buildGpx({ name: 'R', description: 'Nice walk', points: [A, B] });
    expect(withDesc.match(/<desc>Nice walk<\/desc>/g)).toHaveLength(2);
    expect(buildGpx({ name: 'R', points: [A, B] })).not.toContain('<desc>');
  });

  it('adds the time in the file details as UTC, and leaves it out when it is not a time', () => {
    expect(buildGpx({ name: 'R', time: '2026-10-09T12:30:00-04:00', points: [A, B] }))
      .toContain('<time>2026-10-09T16:30:00.000Z</time>');
    expect(buildGpx({ name: 'R', time: 'yesterday', points: [A, B] })).not.toContain('<time>');
    expect(buildGpx({ name: 'R', points: [A, B] })).not.toContain('<time>');
    expect(buildGpx({ name: 'R', time: 1760000000000, points: [A, B] })).not.toContain('<time>');
  });

  it('writes the points in order, to six places, without trailing zeros', () => {
    const xml = buildGpx({
      name: 'R',
      points: [
        { latitude: 40.123456789, longitude: -74.5 },
        { latitude: 40, longitude: 0.1234564 },
      ],
    });
    const lines = xml.split('\n').filter((l) => l.includes('<trkpt'));
    expect(lines[0].trim()).toBe('<trkpt lat="40.123457" lon="-74.5"></trkpt>');
    expect(lines[1].trim()).toBe('<trkpt lat="40" lon="0.123456"></trkpt>');
  });

  it('never writes exponent notation or a negative zero', () => {
    const xml = buildGpx({
      name: 'R',
      points: [
        { latitude: 0.0000001, longitude: -0.0000001 },
        { latitude: -0.0000004, longitude: 0.0000009 },
      ],
    });
    expect(xml).not.toMatch(/(lat|lon)="[^"]*e/i);
    expect(xml).toContain('<trkpt lat="0" lon="0"></trkpt>');
    expect(xml).toContain('<trkpt lat="0" lon="0.000001"></trkpt>');
  });

  it('skips points that are not real places', () => {
    const xml = buildGpx({
      name: 'R',
      points: [
        A,
        null,
        undefined,
        { latitude: NaN, longitude: 1 },
        { latitude: 1, longitude: Infinity },
        { latitude: '40.1', longitude: '-74' },
        { latitude: 91, longitude: 0 },
        { latitude: -91, longitude: 0 },
        { latitude: 0, longitude: -181 },
        { latitude: '40.1', longitude: -74 },
        { latitude: 40.1, longitude: '-74' },
        { longitude: -74 },
        { latitude: 40.7 },
        B,
      ],
    });
    expect(xml.match(/<trkpt /g)).toHaveLength(2);
  });

  it('accepts the edges of the map', () => {
    const xml = buildGpx({
      name: 'R',
      points: [
        { latitude: 90, longitude: 180 },
        { latitude: -90, longitude: -180 },
      ],
    });
    expect(xml.match(/<trkpt /g)).toHaveLength(2);
  });

  it('writes nothing for fewer than two usable points', () => {
    expect(buildGpx({ name: 'R', points: [A] })).toBe('');
    expect(buildGpx({ name: 'R', points: [A, { latitude: NaN, longitude: 0 }] })).toBe('');
    expect(buildGpx({ name: 'R', points: [] })).toBe('');
    expect(buildGpx({ name: 'R' })).toBe('');
    expect(buildGpx({ name: 'R', points: 'nope' })).toBe('');
    expect(buildGpx()).toBe('');
    expect(buildGpx(null)).toBe('');
  });

  it('reads back through parseGpx with the same places', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({
      latitude: 40.7 + i * 0.000137,
      longitude: -74.2 - i * 0.000211,
    }));
    const route = parseGpxToRoute(buildGpx({ name: 'R', points }));
    expect(route.coordinates).toHaveLength(50);
    route.coordinates.forEach((c, i) => {
      expect(c.latitude).toBeCloseTo(points[i].latitude, 6);
      expect(c.longitude).toBeCloseTo(points[i].longitude, 6);
    });
    expect(route.distanceKm).toBeGreaterThan(0);
  });

  it('does not take a file with one track point for a route', () => {
    const one = '<gpx><trk><trkseg><trkpt lat="40.1" lon="-74.2"><ele>5</ele></trkpt></trkseg></trk></gpx>';
    expect(parseGpxToRoute(one)).toBeNull();
    const two = '<gpx><trk><trkseg><trkpt lat="40.1" lon="-74.2"></trkpt><trkpt lat="40.2" lon="-74.2"></trkpt></trkseg></trk></gpx>';
    expect(parseGpxToRoute(two).coordinates).toHaveLength(2);
    expect(parseGpxToRoute('<gpx></gpx>')).toBeNull();
  });

  it('reads back through parseGpx at the poles and across the date line', () => {
    const route = parseGpxToRoute(buildGpx({
      name: 'R',
      points: [{ latitude: -89.5, longitude: -179.9 }, { latitude: 89.5, longitude: 179.9 }],
    }));
    expect(route.coordinates).toEqual([
      { latitude: -89.5, longitude: -179.9 },
      { latitude: 89.5, longitude: 179.9 },
    ]);
  });
});

describe('gpxFileName', () => {
  it('turns a title into letters, numbers and dashes', () => {
    expect(gpxFileName('Wharton State Forest')).toBe('Wharton-State-Forest.gpx');
    expect(gpxFileName("  Bear's Den -- Loop!! ")).toBe('Bear-s-Den-Loop.gpx');
    expect(gpxFileName('../../etc/passwd')).toBe('etc-passwd.gpx');
  });

  it('drops accents instead of the whole letter', () => {
    expect(gpxFileName('Café Zürich')).toBe('Cafe-Zurich.gpx');
  });

  it('falls back to hike when nothing usable is left', () => {
    expect(gpxFileName('')).toBe('hike.gpx');
    expect(gpxFileName(undefined)).toBe('hike.gpx');
    expect(gpxFileName('山道 \u{1F97E}')).toBe('hike.gpx');
    expect(gpxFileName('---')).toBe('hike.gpx');
  });

  it('adds the day, in the phone\'s own time zone', () => {
    // 10:30 pm on the 9th wherever the phone is (in New Jersey that is already the 10th in UTC).
    const late = new Date(2026, 9, 9, 22, 30).toISOString();
    expect(gpxFileName('Ridge', late)).toBe('Ridge-2026-10-09.gpx');
    const earlyMorning = new Date(2026, 0, 2, 0, 20).toISOString();
    expect(gpxFileName('Ridge', earlyMorning)).toBe('Ridge-2026-01-02.gpx');
  });

  it('leaves the day off when the time is missing or not a time', () => {
    expect(gpxFileName('Ridge', '')).toBe('Ridge.gpx');
    expect(gpxFileName('Ridge', 'soon')).toBe('Ridge.gpx');
    expect(gpxFileName('Ridge', 12345)).toBe('Ridge.gpx');
    expect(gpxFileName('Ridge', null)).toBe('Ridge.gpx');
  });

  it('keeps the name to 40 characters and does not end it in a dash', () => {
    const long = gpxFileName('A'.repeat(39) + ' ' + 'B'.repeat(30));
    expect(long).toBe(`${'A'.repeat(39)}.gpx`);
    const exact = gpxFileName('x'.repeat(60));
    expect(exact).toBe(`${'x'.repeat(40)}.gpx`);
  });

  it('only ever makes a safe file name', () => {
    ['a/b\\c', 'x:y*z?', '"quoted"', '<tag>', 'tab\tname', 'null\u0000byte'].forEach((t) => {
      expect(gpxFileName(t, '2026-10-09T16:00:00Z')).toMatch(/^[A-Za-z0-9-]+\.gpx$/);
    });
  });
});

describe('hikeGpxFile', () => {
  it('makes the file for a recorded hike', () => {
    const file = hikeGpxFile(savedHike());
    expect(file.filename).toBe('Wharton-State-Forest-2026-10-09.gpx');
    expect(file.title).toBe('Wharton State Forest (Batsto Loop)');
    expect(file.xml).toContain('<name>Wharton State Forest (Batsto Loop)</name>');
    expect(file.xml).toContain('<desc>Recorded with Zown HQ. 4.25 km, 1:23:45, 63 m climb.</desc>');
    expect(file.xml.match(/<trkpt /g)).toHaveLength(20);
  });

  it('puts the start of the hike in the file details', () => {
    const hike = savedHike();
    const file = hikeGpxFile(hike);
    expect(file.xml).toContain(`<time>${new Date(hike.startTime).toISOString()}</time>`);
  });

  it('is named by the trail alone when no path was chosen', () => {
    const file = hikeGpxFile(savedHike({ pathName: null }));
    expect(file.title).toBe('Wharton State Forest');
    expect(file.xml).toContain('<name>Wharton State Forest</name>');
  });

  it('leaves the climb out of the description when there was none', () => {
    const file = hikeGpxFile(savedHike({ elevationGainM: 0 }));
    expect(file.xml).toContain('<desc>Recorded with Zown HQ. 4.25 km, 1:23:45.</desc>');
    expect(file.xml).not.toContain('climb');
  });

  it('names a hike that was not on a listed trail by the time of day', () => {
    const file = hikeGpxFile(savedHike({ trailName: 'Untitled hike', pathName: null }));
    expect(file.title).toBe('Morning Hike');
    expect(file.filename).toBe('Morning-Hike-2026-10-09.gpx');
  });

  it('uses the finish day when the hike has no start time', () => {
    const file = hikeGpxFile(savedHike({ startTime: '' }));
    expect(file.filename).toMatch(/^Wharton-State-Forest-2026-10-0[89]\.gpx$/);
  });

  it('escapes a trail name with symbols', () => {
    const file = hikeGpxFile(savedHike({ trailName: 'Bear & Fox <Loop>', pathName: '"East"' }));
    expect(file.xml).toContain('<name>Bear &amp; Fox &lt;Loop&gt; (&quot;East&quot;)</name>');
    expect(file.filename).toMatch(/^Bear-Fox-Loop-2026-10-09\.gpx$/);
  });

  it('reads back as the route that was walked (saved routes keep five places)', () => {
    const hike = savedHike();
    const route = parseGpxToRoute(hikeGpxFile(hike).xml);
    expect(route.coordinates).toHaveLength(20);
    expect(route.coordinates[0].latitude).toBeCloseTo(40.7, 5);
    expect(route.coordinates[19].longitude).toBeCloseTo(-74 + 19 * 0.0002, 5);
  });

  it('gives nothing for a hike with no route, a one-point route, or no hike', () => {
    expect(hikeGpxFile(savedHike({ track: [] }))).toBeNull();
    expect(hikeGpxFile(savedHike({ track: undefined }))).toBeNull();
    expect(hikeGpxFile(savedHike({ track: [40.7, -74] }))).toBeNull();
    expect(hikeGpxFile(null)).toBeNull();
    expect(hikeGpxFile(undefined)).toBeNull();
    expect(hikeGpxFile('hike')).toBeNull();
    expect(hikeGpxFile({})).toBeNull();
  });
});

describe('trailGpxFile', () => {
  const route = { coordinates: [A, B, C], distanceKm: 12.345 };

  it('makes the file for a trail route, named by trail and path', () => {
    const file = trailGpxFile({ trail: { name: 'Appalachian Trail' }, pathName: 'Section 4', route });
    expect(file.title).toBe('Appalachian Trail - Section 4');
    expect(file.filename).toBe('Appalachian-Trail-Section-4.gpx');
    expect(file.xml).toContain('<name>Appalachian Trail - Section 4</name>');
    expect(file.xml).toContain('<desc>Trail route, 12.3 km. From Zown HQ.</desc>');
    expect(file.xml.match(/<trkpt /g)).toHaveLength(3);
    expect(file.xml).not.toContain('<time>');
  });

  it('is named by the trail alone without a path', () => {
    const file = trailGpxFile({ trail: { name: '  Ridge Trail ' }, pathName: '   ', route });
    expect(file.title).toBe('Ridge Trail');
    expect(file.filename).toBe('Ridge-Trail.gpx');
  });

  it('ignores a path name that is not text', () => {
    expect(trailGpxFile({ trail: { name: 'T' }, pathName: 42, route }).title).toBe('T');
  });

  it('calls it Trail when it has no name', () => {
    expect(trailGpxFile({ trail: {}, route }).title).toBe('Trail');
    expect(trailGpxFile({ route }).title).toBe('Trail');
    expect(trailGpxFile({ trail: { name: 42 }, pathName: 'Loop', route }).title).toBe('Trail - Loop');
  });

  it('leaves the length out of the description when the route has none', () => {
    const file = trailGpxFile({ trail: { name: 'T' }, route: { coordinates: [A, B] } });
    expect(file.xml).toContain('<desc>Trail route. From Zown HQ.</desc>');
    const nan = trailGpxFile({ trail: { name: 'T' }, route: { coordinates: [A, B], distanceKm: NaN } });
    expect(nan.xml).toContain('<desc>Trail route. From Zown HQ.</desc>');
  });

  it('writes a length of zero as zero', () => {
    const file = trailGpxFile({ trail: { name: 'T' }, route: { coordinates: [A, B], distanceKm: 0 } });
    expect(file.xml).toContain('<desc>Trail route, 0.0 km. From Zown HQ.</desc>');
  });

  it('gives nothing when the route is missing or too short', () => {
    expect(trailGpxFile({ trail: { name: 'T' }, route: { coordinates: [A] } })).toBeNull();
    expect(trailGpxFile({ trail: { name: 'T' }, route: { coordinates: [] } })).toBeNull();
    expect(trailGpxFile({ trail: { name: 'T' }, route: { coordinates: 'x' } })).toBeNull();
    expect(trailGpxFile({ trail: { name: 'T' }, route: null })).toBeNull();
    expect(trailGpxFile({ trail: { name: 'T' } })).toBeNull();
    expect(trailGpxFile()).toBeNull();
    expect(trailGpxFile(null)).toBeNull();
  });

  it('keeps a long route whole', () => {
    const coordinates = Array.from({ length: 1000 }, (_, i) => ({ latitude: 40 + i * 0.0001, longitude: -74 }));
    const file = trailGpxFile({ trail: { name: 'Long' }, route: { coordinates } });
    expect(file.xml.match(/<trkpt /g)).toHaveLength(1000);
    expect(parseGpxToRoute(file.xml).coordinates).toHaveLength(1000);
  });
});
