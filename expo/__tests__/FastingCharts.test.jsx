import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import FastingBarChart, { barLayout } from '../components/FastingBarChart';
import FastingScatterChart, { scatterLayout } from '../components/FastingScatterChart';

const style = (node) => StyleSheet.flatten(node.props.style) || {};
const text = (node) => [].concat(node.props.children).join('');

const bars = (values, extra = {}) => values.map((value, i) => ({
  key: `k${i}`, label: `L${i}`, showLabel: true, value, met: value >= 16, fasts: value > 0 ? 1 : 0, ...extra,
}));

describe('FastingBarChart', () => {
  it('draws nothing with no bars', () => {
    expect(render(<FastingBarChart bars={[]} />).queryByTestId('fast-bar-chart')).toBeNull();
  });

  it('gives each bar a height in proportion to its hours, from the baseline up', () => {
    const utils = render(<FastingBarChart bars={bars([0, 10, 20])} max={20} width={230} height={100} />);
    expect(utils.queryByTestId('fast-bar-0')).toBeNull(); // a day with no fast has no bar
    expect(style(utils.getByTestId('fast-bar-1'))).toMatchObject({ height: 50, top: 50 });
    expect(style(utils.getByTestId('fast-bar-2'))).toMatchObject({ height: 100, top: 0 });
  });

  it('keeps a very short fast visible, and a bar never taller than the chart', () => {
    const utils = render(<FastingBarChart bars={bars([0.2, 40])} max={20} width={230} height={100} />);
    expect(style(utils.getByTestId('fast-bar-0')).height).toBe(3);
    expect(style(utils.getByTestId('fast-bar-1')).height).toBe(100);
  });

  it('paints a bar black when the goal was reached and grey when it was not', () => {
    const utils = render(<FastingBarChart bars={bars([17, 9])} max={20} />);
    expect(style(utils.getByTestId('fast-bar-0')).backgroundColor).toBe('#000000');
    expect(style(utils.getByTestId('fast-bar-1')).backgroundColor).toBe('#B5B5B5');
  });

  it('labels only the bars that ask for one', () => {
    const list = bars([5, 6, 7]);
    list[1].showLabel = false;
    const utils = render(<FastingBarChart bars={list} max={8} />);
    expect(text(utils.getByTestId('fast-bar-label-0'))).toBe('L0');
    expect(utils.queryByTestId('fast-bar-label-1')).toBeNull();
    expect(text(utils.getByTestId('fast-bar-label-2'))).toBe('L2');
  });

  it('writes the hours down the side, with the top one at the top', () => {
    const utils = render(<FastingBarChart bars={bars([5])} max={20} ticks={[0, 10, 20]} width={200} height={100} />);
    expect(text(utils.getByTestId('fast-bar-tick-0'))).toBe('0h');
    expect(text(utils.getByTestId('fast-bar-tick-20'))).toBe('20h');
    expect(style(utils.getByTestId('fast-bar-tick-20')).top).toBeLessThan(style(utils.getByTestId('fast-bar-tick-0')).top);
  });

  it('spreads bars across the width, in order, inside the chart', () => {
    const list = bars(Array.from({ length: 30 }, (_, i) => i + 1));
    const layout = barLayout(list, 30, 300, 100);
    expect(layout).toHaveLength(30);
    layout.forEach((p, i) => {
      expect(p.x).toBeGreaterThanOrEqual(30);
      expect(p.x + p.w).toBeLessThanOrEqual(300);
      if (i) expect(p.x).toBeGreaterThan(layout[i - 1].x + layout[i - 1].w - 0.001);
    });
  });

  it('draws a bar at least three points wide however many days there are', () => {
    expect(barLayout(bars(new Array(60).fill(4)), 8, 120, 100)[0].w).toBe(3);
  });
});

describe('scatterLayout', () => {
  const pts = [{ x: 12, y: 0.4 }, { x: 16, y: -0.2 }, { x: 20, y: -0.8 }];
  const fit = { slope: -0.15, intercept: 2.2, r: -1, n: 3 };

  it('is null with no dots', () => {
    expect(scatterLayout([], fit, 300, 150)).toBeNull();
    expect(scatterLayout(undefined, fit, 300, 150)).toBeNull();
  });

  it('puts longer fasts further right and higher values higher up, inside the plot', () => {
    const l = scatterLayout(pts, fit, 300, 150);
    expect(l.dots[0].x).toBeLessThan(l.dots[1].x);
    expect(l.dots[1].x).toBeLessThan(l.dots[2].x);
    expect(l.dots[0].y).toBeLessThan(l.dots[1].y); // 0.4 is above -0.2 (smaller top)
    expect(l.dots[1].y).toBeLessThan(l.dots[2].y);
    l.dots.forEach((d) => {
      expect(d.x).toBeGreaterThan(l.plot.left);
      expect(d.x).toBeLessThan(l.plot.left + l.plot.width);
      expect(d.y).toBeGreaterThan(l.plot.top);
      expect(d.y).toBeLessThan(l.plot.top + l.plot.height);
    });
  });

  it('draws the line through the fit: its ends sit where the formula puts them', () => {
    const l = scatterLayout(pts, fit, 300, 150);
    const { yRange, xRange, plot } = l;
    const py = (y) => plot.top + (1 - (y - yRange[0]) / (yRange[1] - yRange[0])) * plot.height;
    expect(l.line.x1).toBeLessThan(l.line.x2);
    expect(l.line.y1).toBeCloseTo(py(2.2 + -0.15 * xRange[0]), 6);
    expect(l.line.y2).toBeCloseTo(py(2.2 + -0.15 * xRange[1]), 6);
    expect(l.line.y2).toBeGreaterThan(l.line.y1); // it slopes down to the right
  });

  it('has no line without a slope', () => {
    expect(scatterLayout(pts, null, 300, 150).line).toBeNull();
    expect(scatterLayout(pts, { slope: null, intercept: null, r: null, n: 3 }, 300, 150).line).toBeNull();
  });

  it('marks zero only when the dots cross it', () => {
    const crossing = scatterLayout(pts, fit, 300, 150);
    expect(crossing.zeroY).not.toBeNull();
    expect(crossing.zeroY).toBeGreaterThan(crossing.dots[0].y);
    expect(crossing.zeroY).toBeLessThan(crossing.dots[2].y);
    expect(scatterLayout([{ x: 12, y: 1500 }, { x: 16, y: 1800 }], null, 300, 150).zeroY).toBeNull();
  });

  it('copes with every dot in the same place', () => {
    const l = scatterLayout([{ x: 16, y: 5 }, { x: 16, y: 5 }], null, 300, 150);
    l.dots.forEach((d) => {
      expect(Number.isFinite(d.x)).toBe(true);
      expect(Number.isFinite(d.y)).toBe(true);
    });
  });
});

describe('FastingScatterChart', () => {
  const pts = [{ x: 12, y: 0.4 }, { x: 16, y: -0.2 }, { x: 20, y: -0.8 }];

  it('draws nothing with no dots', () => {
    expect(render(<FastingScatterChart points={[]} />).queryByTestId('fast-scatter-chart')).toBeNull();
  });

  it('draws a dot for each point, at the place the layout gives', () => {
    const utils = render(<FastingScatterChart points={pts} fit={null} width={300} height={150} />);
    const l = scatterLayout(pts, null, 300, 150);
    [0, 1, 2].forEach((i) => {
      const s = style(utils.getByTestId(`fast-dot-${i}`));
      expect(s.left).toBeCloseTo(l.dots[i].x - 5, 6);
      expect(s.top).toBeCloseTo(l.dots[i].y - 5, 6);
    });
    expect(utils.queryByTestId('fast-dot-3')).toBeNull();
  });

  it('writes the ends of both axes with the formatters it is given', () => {
    const utils = render(
      <FastingScatterChart points={pts} fit={null} formatX={(v) => `${Math.round(v)} hrs`} formatY={(v) => `y${v.toFixed(1)}`} />,
    );
    const l = scatterLayout(pts, null, 300, 150);
    expect(text(utils.getByTestId('fast-scatter-x-left'))).toBe(`${Math.round(l.xRange[0])} hrs`);
    expect(text(utils.getByTestId('fast-scatter-x-right'))).toBe(`${Math.round(l.xRange[1])} hrs`);
    expect(text(utils.getByTestId('fast-scatter-y-top'))).toBe(`y${l.yRange[1].toFixed(1)}`);
    expect(text(utils.getByTestId('fast-scatter-y-bottom'))).toBe(`y${l.yRange[0].toFixed(1)}`);
  });
});
