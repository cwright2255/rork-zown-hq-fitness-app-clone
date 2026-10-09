import { sketchFrame } from '../lib/trailSketch';

const pt = (latitude, longitude) => ({ latitude, longitude });
const nums = (text) => text.split(' ').map((pair) => pair.split(',').map(Number));

describe('sketchFrame', () => {
  it('has nothing to draw without points', () => {
    expect(sketchFrame([])).toBeNull();
    expect(sketchFrame(null)).toBeNull();
    expect(sketchFrame([{ latitude: 'x', longitude: 1 }, null])).toBeNull();
  });

  it('puts a single point in the middle of the picture', () => {
    const frame = sketchFrame([pt(38, -78)], { width: 300, height: 200 });
    expect(frame.project(pt(38, -78))).toEqual({ x: 150, y: 100 });
  });

  it('draws north at the top and east on the right', () => {
    const frame = sketchFrame([pt(38, -78), pt(38.01, -77.99)]);
    const sw = frame.project(pt(38, -78));
    const ne = frame.project(pt(38.01, -77.99));
    expect(ne.y).toBeLessThan(sw.y);
    expect(ne.x).toBeGreaterThan(sw.x);
  });

  it('keeps every point inside the picture, with room round the edge', () => {
    const points = [pt(38, -78), pt(38.05, -77.95), pt(38.02, -78.03), pt(37.99, -77.96)];
    const frame = sketchFrame(points, { width: 300, height: 200, margin: 20 });
    points.forEach((p) => {
      const { x, y } = frame.project(p);
      expect(x).toBeGreaterThanOrEqual(19.9);
      expect(x).toBeLessThanOrEqual(280.1);
      expect(y).toBeGreaterThanOrEqual(19.9);
      expect(y).toBeLessThanOrEqual(180.1);
    });
  });

  it('fills the picture along its longer side, with the margin left over', () => {
    const wide = sketchFrame([pt(38, -78), pt(38.001, -77.95)], { width: 300, height: 200, margin: 20, minSpanDeg: 0.0001 });
    const a = wide.project(pt(38, -78));
    const b = wide.project(pt(38.001, -77.95));
    expect(a.x).toBeCloseTo(20, 0);
    expect(b.x).toBeCloseTo(280, 0);
  });

  it('keeps the shape true: a degree of longitude is shorter than one of latitude away from the equator', () => {
    const frame = sketchFrame([pt(60, 10), pt(60.1, 10.2)], { width: 1000, height: 1000, margin: 0, minSpanDeg: 0.0001 });
    const a = frame.project(pt(60, 10));
    const b = frame.project(pt(60.1, 10.2));
    // 0.1 deg north and 0.2 deg east at 60 north are about the same distance
    expect(Math.abs(b.x - a.x) / Math.abs(b.y - a.y)).toBeGreaterThan(0.95);
    expect(Math.abs(b.x - a.x) / Math.abs(b.y - a.y)).toBeLessThan(1.05);
  });

  it('centres what it draws', () => {
    const frame = sketchFrame([pt(38, -78), pt(38.01, -77.99)], { width: 300, height: 200, margin: 10 });
    const a = frame.project(pt(38, -78));
    const b = frame.project(pt(38.01, -77.99));
    expect((a.x + b.x) / 2).toBeCloseTo(150, 0);
    expect((a.y + b.y) / 2).toBeCloseTo(100, 0);
  });

  it('does not blow a tiny area up to fill the picture', () => {
    // two points 11 m apart: shown at the smallest area, not stretched out
    const frame = sketchFrame([pt(38, -78), pt(38.0001, -78)], { width: 300, height: 200, margin: 20, minSpanDeg: 0.004 });
    const a = frame.project(pt(38, -78));
    const b = frame.project(pt(38.0001, -78));
    expect(Math.abs(a.y - b.y)).toBeLessThan(5);
  });

  it('does not blow a tiny area up east to west either', () => {
    const frame = sketchFrame([pt(38, -78), pt(38, -77.9999)], { width: 300, height: 200, margin: 20, minSpanDeg: 0.004 });
    const a = frame.project(pt(38, -78));
    const b = frame.project(pt(38, -77.9999));
    expect(Math.abs(a.x - b.x)).toBeLessThan(5);
  });

  it('applies the smallest area to the width as well as the height', () => {
    // 0.0038 deg of longitude is just under the smallest area once shortened for the latitude;
    // on a tall picture the width is what limits the scale
    const frame = sketchFrame([pt(38, -78), pt(38, -77.9962)], { width: 200, height: 300, margin: 20, minSpanDeg: 0.004 });
    const a = frame.project(pt(38, -78));
    const b = frame.project(pt(38, -77.9962));
    expect(b.x - a.x).toBeGreaterThan(115);
    expect(b.x - a.x).toBeLessThan(125);
  });

  it('draws all the lines in the same frame', () => {
    const frame = sketchFrame([pt(38, -78), pt(38.01, -77.99)]);
    const one = frame.line([pt(38, -78), pt(38.01, -77.99)]);
    const part = frame.line([pt(38.01, -77.99)]);
    expect(one.endsWith(part)).toBe(true);
  });

  it('writes a line as x,y pairs to the nearest tenth', () => {
    const frame = sketchFrame([pt(38, -78), pt(38.01, -77.99)]);
    const text = frame.line([pt(38, -78), pt(38.005, -77.995), pt(38.01, -77.99)]);
    expect(text).toMatch(/^-?\d+(\.\d)?,-?\d+(\.\d)? -?\d+(\.\d)?,-?\d+(\.\d)? -?\d+(\.\d)?,-?\d+(\.\d)?$/);
    expect(nums(text)).toHaveLength(3);
  });

  it('leaves points that are not places out of a line, and gives an empty line for none', () => {
    const frame = sketchFrame([pt(38, -78), pt(38.01, -77.99)]);
    expect(nums(frame.line([pt(38, -78), null, { latitude: NaN, longitude: 0 }, pt(38.01, -77.99)]))).toHaveLength(2);
    expect(frame.line([])).toBe('');
    expect(frame.line(null)).toBe('');
  });

  it('copes with the poles', () => {
    const frame = sketchFrame([pt(90, 0), pt(89.9, 10)]);
    const { x, y } = frame.project(pt(90, 0));
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });

  it('says how big the picture is', () => {
    const frame = sketchFrame([pt(38, -78)], { width: 120, height: 80 });
    expect(frame).toMatchObject({ width: 120, height: 80 });
  });
});
