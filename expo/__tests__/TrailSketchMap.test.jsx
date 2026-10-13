import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Circle, Polyline, Svg } from 'react-native-svg';

import TrailSketchMap from '../components/TrailSketchMap';
import { MAP_BG } from '../constants/runMap';

const pt = (i) => ({ latitude: 38 + i * 0.0005, longitude: -78 + i * 0.0003 });
const line = (n) => Array.from({ length: n }, (_, i) => pt(i));
const points = (utils) => utils.UNSAFE_getAllByType(Polyline).map((p) => p.props.points.split(' ').length);

describe('TrailSketchMap', () => {
  it('is a plain dark picture with nothing on it when there is nothing to draw', () => {
    const utils = render(<TrailSketchMap />);
    const box = utils.getByTestId('trail-sketch');
    expect(box.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: MAP_BG })]));
    expect(utils.UNSAFE_queryAllByType(Svg)).toHaveLength(0);
  });

  it('draws the trail dashed, with a ring where it starts and a dot where it ends', () => {
    const utils = render(<TrailSketchMap planned={line(6)} />);
    const lines = utils.UNSAFE_getAllByType(Polyline);
    expect(lines).toHaveLength(1);
    expect(lines[0].props.strokeDasharray).toBeTruthy();
    expect(points(utils)).toEqual([6]);
    // a halo and a ring for the start, a halo and a dot for the end
    const circles = utils.UNSAFE_getAllByType(Circle);
    expect(circles).toHaveLength(4);
    const ring = circles.find((c) => c.props.fill === 'none');
    expect(ring).toBeTruthy();
  });

  it('draws the start where the trail starts and the end where it ends', () => {
    const utils = render(<TrailSketchMap planned={line(6)} />);
    const [first, ...rest] = utils.UNSAFE_getAllByType(Polyline)[0].props.points.split(' ');
    const last = rest[rest.length - 1];
    const [startX, startY] = first.split(',').map(Number);
    const [endX, endY] = last.split(',').map(Number);
    const circles = utils.UNSAFE_getAllByType(Circle);
    expect(circles[0].props.cx).toBe(startX);
    expect(circles[0].props.cy).toBe(startY);
    expect(circles[3].props.cx).toBe(endX);
    expect(circles[3].props.cy).toBe(endY);
  });

  it('draws the path walked solid, with a glow, over the trail', () => {
    const utils = render(<TrailSketchMap planned={line(6)} walked={line(4)} />);
    const lines = utils.UNSAFE_getAllByType(Polyline);
    expect(lines).toHaveLength(3);
    expect(lines[0].props.strokeDasharray).toBeTruthy();
    expect(lines[1].props.strokeDasharray).toBeUndefined();
    expect(lines[2].props.strokeDasharray).toBeUndefined();
    expect(lines[1].props.strokeWidth).toBeGreaterThan(lines[2].props.strokeWidth);
    expect(lines[2].props.stroke).toBe('#FFFFFF');
  });

  it('keeps the path walked in the picture even when it goes well beyond the trail', () => {
    const walked = Array.from({ length: 8 }, (_, i) => ({ latitude: 38 + i * 0.01, longitude: -78 - i * 0.01 }));
    const utils = render(<TrailSketchMap planned={line(3)} walked={walked} />);
    const lines = utils.UNSAFE_getAllByType(Polyline);
    lines.forEach((l) => {
      l.props.points.split(' ').forEach((pair) => {
        const [x, y] = pair.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(300);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(200);
      });
    });
  });

  it('puts the hiker on it as a dot with a halo', () => {
    const utils = render(<TrailSketchMap planned={line(6)} current={pt(3)} />);
    const circles = utils.UNSAFE_getAllByType(Circle);
    expect(circles).toHaveLength(6);
    const halo = circles[4];
    const dot = circles[5];
    expect(halo.props.r).toBeGreaterThan(dot.props.r);
    expect(dot.props.cx).toBe(halo.props.cx);
    expect(dot.props.fill).toBe('#FFFFFF');
  });

  it('draws the hiker alone, without a trail, and the path walked so far', () => {
    const utils = render(<TrailSketchMap walked={line(5)} current={pt(4)} />);
    expect(utils.UNSAFE_getAllByType(Polyline)).toHaveLength(2);
    expect(utils.UNSAFE_getAllByType(Circle)).toHaveLength(2);
  });

  it('draws just the hiker at the start of a hike, before there is a path', () => {
    const utils = render(<TrailSketchMap current={pt(0)} />);
    expect(utils.UNSAFE_queryAllByType(Polyline)).toHaveLength(0);
    expect(utils.UNSAFE_getAllByType(Circle)).toHaveLength(2);
  });

  it('does not draw a line from a single point', () => {
    const utils = render(<TrailSketchMap planned={line(1)} walked={line(1)} />);
    expect(utils.UNSAFE_queryAllByType(Polyline)).toHaveLength(0);
    expect(utils.UNSAFE_queryAllByType(Circle)).toHaveLength(0);
  });

  it('shows the hiker where they are on the trail: on its line when they stand on it', () => {
    const planned = line(10);
    const utils = render(<TrailSketchMap planned={planned} current={planned[5]} />);
    const pairs = utils.UNSAFE_getAllByType(Polyline)[0].props.points.split(' ');
    const [x, y] = pairs[5].split(',').map(Number);
    const dot = utils.UNSAFE_getAllByType(Circle)[5];
    expect(dot.props.cx).toBe(x);
    expect(dot.props.cy).toBe(y);
  });

  it('draws a very long path with a reasonable number of points', () => {
    const utils = render(<TrailSketchMap planned={line(5000)} walked={line(3000)} />);
    points(utils).forEach((n) => expect(n).toBeLessThanOrEqual(600));
    expect(Math.max(...points(utils))).toBe(600);
  });

  it('takes the look of the container from its style and test id', () => {
    const utils = render(<TrailSketchMap planned={line(3)} style={{ height: 220 }} testID="my-sketch" />);
    expect(utils.getByTestId('my-sketch').props.style).toEqual(expect.arrayContaining([{ height: 220 }]));
  });
  describe('other paths nearby', () => {
    const FAINT = 'rgba(255, 255, 255, 0.3)';
    // a line `n` points long starting `dLat` degrees north of the first test point
    const north = (dLat, n = 4) => Array.from({ length: n }, (_, i) => ({ latitude: 38 + dLat + i * 0.0005, longitude: -78 }));

    it('draws each as a faint solid line, under the trail', () => {
      const utils = render(<TrailSketchMap planned={line(6)} others={[north(0.001), north(0.002, 5)]} current={pt(2)} />);
      const lines = utils.UNSAFE_getAllByType(Polyline);
      expect(lines).toHaveLength(3);
      expect(lines[0].props.stroke).toBe(FAINT);
      expect(lines[1].props.stroke).toBe(FAINT);
      expect(lines[0].props.strokeDasharray).toBeUndefined();
      expect(lines[1].props.strokeDasharray).toBeUndefined();
      expect(lines[2].props.strokeDasharray).toBeTruthy();
      expect(lines[0].props.points.split(' ')).toHaveLength(4);
      expect(lines[1].props.points.split(' ')).toHaveLength(5);
    });

    it('draws them with only the hiker on the picture, and no start or end rings', () => {
      const utils = render(<TrailSketchMap others={[north(0.001)]} current={north(0.0005, 1)[0]} />);
      expect(utils.UNSAFE_getAllByType(Polyline)).toHaveLength(1);
      expect(utils.UNSAFE_getAllByType(Circle)).toHaveLength(2);
    });

    it('does not draw one with fewer than two points, or anything that is not a list', () => {
      const utils = render(<TrailSketchMap planned={line(4)} others={[north(0.001, 1), []]} />);
      expect(utils.UNSAFE_getAllByType(Polyline)).toHaveLength(1);
      expect(() => render(<TrailSketchMap planned={line(4)} others={null} />)).not.toThrow();
      expect(() => render(<TrailSketchMap planned={line(4)} others="x" />)).not.toThrow();
    });

    it('draws a very long one with a reasonable number of points', () => {
      const utils = render(<TrailSketchMap others={[line(2000)]} current={pt(0)} />);
      expect(points(utils)).toEqual([300]);
    });

    it('makes room for a path near the hiker', () => {
      const alone = render(<TrailSketchMap planned={line(3)} current={pt(1)} />).UNSAFE_getAllByType(Polyline)[0].props.points;
      // about 300 m north of the trail: inside the 600 m that count, and past the trail's own extent
      const withNear = render(<TrailSketchMap planned={line(3)} others={[north(0.0027)]} current={pt(1)} />).UNSAFE_getAllByType(Polyline);
      expect(withNear[1].props.points).not.toBe(alone);
    });

    it('does not shrink the picture to fit a path far from the hiker, which runs in from the edge instead', () => {
      const alone = render(<TrailSketchMap planned={line(3)} current={pt(1)} />).UNSAFE_getAllByType(Polyline)[0].props.points;
      // about 5 km north
      const withFar = render(<TrailSketchMap planned={line(3)} others={[north(0.05)]} current={pt(1)} />).UNSAFE_getAllByType(Polyline);
      expect(withFar[1].props.points).toBe(alone);
    });

    it('counts all of every path when the hiker is not known', () => {
      const alone = render(<TrailSketchMap planned={line(3)} />).UNSAFE_getAllByType(Polyline)[0].props.points;
      const withFar = render(<TrailSketchMap planned={line(3)} others={[north(0.05)]} />).UNSAFE_getAllByType(Polyline);
      expect(withFar[1].props.points).not.toBe(alone);
    });

    it('does not move anything else: with no other paths the picture is the same', () => {
      const a = render(<TrailSketchMap planned={line(5)} walked={line(3)} current={pt(2)} />).UNSAFE_getAllByType(Polyline).map((l) => l.props.points);
      const b = render(<TrailSketchMap planned={line(5)} walked={line(3)} others={[]} current={pt(2)} />).UNSAFE_getAllByType(Polyline).map((l) => l.props.points);
      expect(b).toEqual(a);
    });
  });

  describe('the size of the picture', () => {
    const layout = (width, height) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    const viewBox = (utils) => utils.UNSAFE_getByType(Svg).props.viewBox;

    it('is 300 by 200 until the box has been measured', () => {
      expect(viewBox(render(<TrailSketchMap planned={line(4)} />))).toBe('0 0 300 200');
    });

    it('fills the box it is given, whatever its shape', () => {
      const utils = render(<TrailSketchMap planned={line(6)} walked={line(3)} current={pt(2)} />);
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(361, 405));
      expect(viewBox(utils)).toBe('0 0 361 405');
      // everything stays inside the picture, which is now 361 by 405
      utils.UNSAFE_getAllByType(Polyline).forEach((l) => {
        l.props.points.split(' ').forEach((pair) => {
          const [x, y] = pair.split(',').map(Number);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(361);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(405);
        });
      });
    });

    it('uses the room: a taller box gives a longer picture of a trail that runs north to south', () => {
      const straight = Array.from({ length: 6 }, (_, i) => ({ latitude: 38 + i * 0.002, longitude: -78 }));
      const height = (utils) => {
        const ys = utils.UNSAFE_getAllByType(Polyline)[0].props.points.split(' ').map((pair) => Number(pair.split(',')[1]));
        return Math.max(...ys) - Math.min(...ys);
      };
      const small = render(<TrailSketchMap planned={straight} />);
      const tall = render(<TrailSketchMap planned={straight} />);
      fireEvent(tall.getByTestId('trail-sketch'), 'layout', layout(300, 420));
      expect(height(tall)).toBeGreaterThan(height(small) * 1.8);
    });

    it('rounds the size to whole points', () => {
      const utils = render(<TrailSketchMap planned={line(4)} />);
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(360.6, 404.4));
      expect(viewBox(utils)).toBe('0 0 361 404');
    });

    it('ignores a box with no size yet', () => {
      const utils = render(<TrailSketchMap planned={line(4)} />);
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(0, 0));
      expect(viewBox(utils)).toBe('0 0 300 200');
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(300, 0));
      expect(viewBox(utils)).toBe('0 0 300 200');
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(0, 200));
      expect(viewBox(utils)).toBe('0 0 300 200');
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', { nativeEvent: {} });
      expect(viewBox(utils)).toBe('0 0 300 200');
    });

    it('is measured even while there is nothing to draw yet', () => {
      const utils = render(<TrailSketchMap />);
      fireEvent(utils.getByTestId('trail-sketch'), 'layout', layout(400, 500));
      utils.rerender(<TrailSketchMap planned={line(4)} />);
      expect(viewBox(utils)).toBe('0 0 400 500');
    });
  });
});
