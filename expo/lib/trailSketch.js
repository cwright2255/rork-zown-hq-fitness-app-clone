// lib/trailSketch.js
//
// Draws a trail as a flat picture with no map behind it, for when there is no
// signal to load map tiles. The frame is worked out once from every point that
// has to be in view (the trail, the path walked so far, the hiker), and each
// line is then drawn inside it, so they all line up.

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const valid = (p) => !!p && isNum(p.latitude) && isNum(p.longitude);
const tenth = (n) => Math.round(n * 10) / 10;

/**
 * @param points  every point that has to fit
 * @param options width/height of the picture, margin round the edge, and
 *                minSpanDeg: the smallest area shown, in degrees, so a single
 *                point (the start of a hike) is not blown up to fill the picture
 * @returns {{ width, height, project(point), line(points) } | null}
 *          null when there is nothing to draw
 */
export function sketchFrame(points, { width = 300, height = 200, margin = 18, minSpanDeg = 0.004 } = {}) {
  const pts = Array.isArray(points) ? points.filter(valid) : [];
  if (pts.length === 0) return null;
  const midLat = pts.reduce((sum, p) => sum + p.latitude, 0) / pts.length;
  // Longitude degrees get shorter away from the equator.
  const kx = Math.max(0.01, Math.cos((midLat * Math.PI) / 180));
  const xs = pts.map((p) => p.longitude * kx);
  const ys = pts.map((p) => -p.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, minSpanDeg);
  const spanY = Math.max(maxY - minY, minSpanDeg);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const project = (p) => ({
    x: tenth(width / 2 + (p.longitude * kx - cx) * scale),
    y: tenth(height / 2 + (-p.latitude - cy) * scale),
  });
  const line = (list) => (Array.isArray(list) ? list.filter(valid) : [])
    .map((p) => {
      const q = project(p);
      return `${q.x},${q.y}`;
    })
    .join(' ');

  return { width, height, project, line };
}
