// The login screen is white above a line and black below it. The line must rise to the right at 25 degrees on every
// phone, the black wordmark must sit on the white, and the white tagline must sit on the black.
import { loginLayout, diagonalY, DIAGONAL_ANGLE_DEG, RIGHT_EDGE_Y } from '../lib/loginLayout';

const WIDTHS = [320, 360, 375, 390, 393, 402, 414, 428, 430, 440];

// The white shape is "0,0 W,0 W,rightY 0,leftY": the line is its last two points.
function lineOf(layout) {
  const pts = layout.whitePoints.split(' ').map((p) => p.split(',').map(Number));
  return { top: pts[0], topRight: pts[1], right: pts[2], left: pts[3] };
}

describe('login screen layout', () => {
  it('rises to the right at 25 degrees', () => {
    expect(DIAGONAL_ANGLE_DEG).toBe(25);
    for (const w of WIDTHS) {
      const { right, left } = lineOf(loginLayout(w));
      const degrees = (Math.atan2(left[1] - right[1], right[0] - left[0]) * 180) / Math.PI;
      expect(degrees).toBeCloseTo(25, 6);
    }
  });

  it('leaves the right-hand edge 65 points from the top, whatever the width', () => {
    expect(RIGHT_EDGE_Y).toBe(65);
    for (const w of WIDTHS) {
      const layout = loginLayout(w);
      expect(lineOf(layout).right).toEqual([w, 65]);
      expect(layout.rightY).toBe(65);
      expect(diagonalY(w, w)).toBeCloseTo(65, 9);
    }
  });

  it('reaches the left-hand edge lower by width times tan 25', () => {
    const layout = loginLayout(393);
    expect(layout.leftY).toBeCloseTo(65 + 393 * Math.tan((25 * Math.PI) / 180), 6);
    expect(lineOf(layout).left[0]).toBe(0);
    expect(lineOf(layout).left[1]).toBeCloseTo(layout.leftY, 6);
  });

  it('covers the top corners of the screen with white', () => {
    for (const w of WIDTHS) {
      const { top, topRight } = lineOf(loginLayout(w));
      expect(top).toEqual([0, 0]);
      expect(topRight).toEqual([w, 0]);
    }
  });

  it('keeps the whole wordmark on the white, clear of the line', () => {
    for (const w of WIDTHS) {
      const { logo } = loginLayout(w);
      // the line is lowest at the left, so the right-hand end of the wordmark is the part nearest it
      const lineAtRightEnd = diagonalY(logo.left + logo.width, w);
      expect(logo.top + logo.height).toBeLessThanOrEqual(lineAtRightEnd - 8);
      expect(logo.top).toBeGreaterThanOrEqual(50); // below the Dynamic Island
      expect(logo.left).toBeGreaterThanOrEqual(0);
      expect(logo.left + logo.width).toBeLessThanOrEqual(w);
    }
  });

  it('centres the wordmark across the screen', () => {
    for (const w of WIDTHS) {
      const { logo } = loginLayout(w);
      expect(Math.abs(logo.left - (w - logo.width - logo.left))).toBeLessThanOrEqual(1);
    }
  });

  it('puts the tagline on the black, clear of the line, and inside the screen', () => {
    for (const w of WIDTHS) {
      const { tagline } = loginLayout(w);
      // the left-hand end of the tagline is the part nearest the white
      expect(tagline.top).toBeGreaterThanOrEqual(diagonalY(tagline.left, w) + 6);
      expect(tagline.left).toBeGreaterThanOrEqual(0);
      expect(w - tagline.right).toBeLessThanOrEqual(w);
      expect(tagline.right).toBe(20);
    }
  });

  it('keeps the tagline below the wordmark and both above the form', () => {
    for (const w of WIDTHS) {
      const layout = loginLayout(w);
      expect(layout.logo.top + layout.logo.height).toBeLessThan(layout.tagline.top);
      expect(layout.tagline.bottom).toBeLessThanOrEqual(layout.headerHeight);
      expect(layout.leftY).toBeLessThanOrEqual(layout.headerHeight);
    }
  });

  it('sizes the tagline to the phone, up to 44 points', () => {
    expect(loginLayout(320).tagline.fontSize).toBeLessThan(loginLayout(440).tagline.fontSize);
    expect(loginLayout(440).tagline.fontSize).toBeLessThanOrEqual(44);
    expect(loginLayout(393).tagline.lineHeight).toBeGreaterThan(loginLayout(393).tagline.fontSize);
  });
});
