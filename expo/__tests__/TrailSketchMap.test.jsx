import React from 'react';
import { render } from '@testing-library/react-native';
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
});
