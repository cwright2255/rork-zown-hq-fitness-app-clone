// One reading's card on the Health page's Trends section (components/TrendChart.jsx): the average, how many days have a reading,
// the comparison with the period before, the line and a dot for each reading, and tapping to read a day.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// SVG has no renderer under Jest, so the line becomes a plain element whose `d` can be read.
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }), { virtual: true });

import TrendChart, { trendSummary } from '../components/TrendChart';
import { trendSeries, trendGeometry } from '../lib/dailyReadings';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);
const seriesOf = (entries, days = 7) => {
  const map = {};
  for (const [offset, value] of entries) map[day(offset)] = value;
  return trendSeries(map, TODAY, days);
};
// Oct 14, 17, 19 and 20 have a reading; the 20th is the newest.
const RHR = () => seriesOf([[-6, 60], [-3, 62], [-1, 66], [0, 64]]);

const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
// The value that wins: later styles override earlier ones.
const pick = (node, key) => [...flat(node)].reverse().find((s) => s[key] !== undefined)?.[key];
const tapAt = (node, x) => fireEvent.press(node, { nativeEvent: { locationX: x } });

const show = (props = {}) => render(
  <TrendChart testID="t" title="Resting heart rate" series={RHR()} unit="bpm" width={300} height={84} {...props} />,
);

describe('a reading with a history', () => {
  it('names the reading and gives the average, the days it covers and the newest reading', () => {
    const { getByText, getByTestId } = show();
    expect(getByText('Resting heart rate')).toBeTruthy();
    expect(getByTestId('t-average').props.children).toBe('63 bpm');
    expect(getByText('7-day average')).toBeTruthy();
    expect(getByTestId('t-coverage').props.children).toBe('4 of 7 days');
    expect(getByTestId('t-readout').props.children).toBe('Latest, Oct 20: 64 bpm');
  });

  it('writes the average with the decimals it is given', () => {
    const { getByTestId } = show({ title: 'Sleep', series: seriesOf([[-2, 7.2], [-1, 7.5], [0, 6.9]]), unit: 'h', decimals: 1 });
    expect(getByTestId('t-average').props.children).toBe('7.2 h');
    expect(getByTestId('t-readout').props.children).toBe('Latest, Oct 20: 6.9 h');
  });

  it('says how many days the period is', () => {
    const { getByText, getByTestId } = show({ series: seriesOf([[-20, 60], [-10, 62], [0, 64]], 28) });
    expect(getByText('28-day average')).toBeTruthy();
    expect(getByTestId('t-coverage').props.children).toBe('3 of 28 days');
  });

  it('compares with the period before only when there are enough readings in both', () => {
    const none = show();
    expect(none.getByTestId('t-coverage').props.children).not.toMatch(/before/);
    const some = show({ series: seriesOf([[-6, 60], [-3, 62], [0, 64], [-8, 58], [-10, 58], [-12, 58]]) });
    expect(some.getByTestId('t-coverage').props.children).toBe('3 of 7 days  \u00B7  +4 bpm vs the 7 days before');
    const same = show({ series: seriesOf([[-6, 60], [-3, 60], [0, 60], [-8, 60], [-10, 60], [-12, 60]]) });
    expect(same.getByTestId('t-coverage').props.children).toBe('3 of 7 days  \u00B7  no change vs the 7 days before');
  });

  it('draws a dot for each reading, in black, in the place the geometry says', () => {
    const { getByTestId, queryByTestId } = show();
    const expected = trendGeometry(RHR().points, 300, 84).dots;
    expect(expected).toHaveLength(4);
    for (const dot of expected) {
      const node = getByTestId(`t-dot-${dot.index}`);
      expect(pick(node, 'width')).toBe(12);
      expect(pick(node, 'height')).toBe(12);
      expect(pick(node, 'left')).toBe(dot.x - 6);
      expect(pick(node, 'top')).toBe(dot.y - 6);
      expect(pick(node, 'backgroundColor')).toBe('#000000');
      expect(pick(node, 'borderColor')).toBe('#FFFFFF');
      expect(pick(node, 'borderWidth')).toBe(2);
    }
    for (const i of [1, 2, 4]) expect(queryByTestId(`t-dot-${i}`)).toBeNull();
  });

  it('draws the line as a black 2 pixel stroke through days that follow each other, and breaks it at a gap', () => {
    const { UNSAFE_getAllByType } = show();
    const paths = UNSAFE_getAllByType('Path');
    const expected = trendGeometry(RHR().points, 300, 84).paths;
    expect(expected).toHaveLength(1); // Oct 19 and 20 only: Oct 14 and 17 stand alone
    expect(paths.map((p) => p.props.d)).toEqual(expected);
    expect(paths[0].props.stroke).toBe('#000000');
    expect(paths[0].props.strokeWidth).toBe(2);
    expect(paths[0].props.fill).toBe('none');
  });

  it('draws no line for a lone reading, only its dot', () => {
    const { UNSAFE_queryAllByType, getByTestId } = show({ series: seriesOf([[-2, 60]]) });
    expect(UNSAFE_queryAllByType('Path')).toHaveLength(0);
    expect(getByTestId('t-dot-4')).toBeTruthy();
  });

  it('labels the start of the period and today under the chart', () => {
    const { getByText } = show();
    expect(getByText('Oct 14')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
  });

  it('is 300 wide and 84 tall unless it is told otherwise', () => {
    const { getByTestId } = render(<TrendChart testID="t" title="Sleep" series={RHR()} unit="bpm" />);
    expect(pick(getByTestId('t-chart'), 'width')).toBe(300);
    expect(pick(getByTestId('t-chart'), 'height')).toBe(84);
    expect(pick(getByTestId('t-drawing'), 'width')).toBe(300);
    expect(pick(getByTestId('t-drawing'), 'height')).toBe(84);
  });

  it('leaves every touch to the chart, so a tap on a dot or the line is a tap on the chart', () => {
    expect(show().getByTestId('t-drawing').props.pointerEvents).toBe('none');
  });

  it('is as wide and as tall as it is told', () => {
    const { getByTestId } = show({ width: 222, height: 90 });
    expect(pick(getByTestId('t-chart'), 'width')).toBe(222);
    expect(pick(getByTestId('t-chart'), 'height')).toBe(90);
    expect(pick(getByTestId('t-drawing'), 'width')).toBe(222);
    expect(pick(getByTestId('t-drawing'), 'height')).toBe(90);
  });
});

describe('tapping the chart', () => {
  it('reads out the day nearest the finger', () => {
    const { getByTestId } = show();
    const dots = trendGeometry(RHR().points, 300, 84).dots; // x of Oct 14, 17, 19, 20: 10, 150, 243.3, 290
    tapAt(getByTestId('t-chart'), dots[1].x + 5);
    expect(getByTestId('t-readout').props.children).toBe('Oct 17: 62 bpm');
    tapAt(getByTestId('t-chart'), 0);
    expect(getByTestId('t-readout').props.children).toBe('Oct 14: 60 bpm');
    tapAt(getByTestId('t-chart'), 299);
    expect(getByTestId('t-readout').props.children).toBe('Oct 20: 64 bpm');
  });

  it('makes the picked dot bigger, white inside and ringed in black', () => {
    const { getByTestId } = show();
    const dots = trendGeometry(RHR().points, 300, 84).dots;
    tapAt(getByTestId('t-chart'), dots[1].x);
    const node = getByTestId(`t-dot-${dots[1].index}`);
    expect(pick(node, 'width')).toBe(18);
    expect(pick(node, 'height')).toBe(18);
    expect(pick(node, 'left')).toBe(dots[1].x - 9);
    expect(pick(node, 'top')).toBe(dots[1].y - 9);
    expect(pick(node, 'borderRadius')).toBe(9);
    expect(pick(node, 'backgroundColor')).toBe('#FFFFFF');
    expect(pick(node, 'borderColor')).toBe('#000000');
    expect(pick(node, 'borderWidth')).toBe(3);
    // the others stay as they were
    expect(pick(getByTestId(`t-dot-${dots[0].index}`), 'width')).toBe(12);
    expect(pick(getByTestId(`t-dot-${dots[0].index}`), 'backgroundColor')).toBe('#000000');
  });

  it('clears the day when it is tapped again', () => {
    const { getByTestId } = show();
    const dots = trendGeometry(RHR().points, 300, 84).dots;
    tapAt(getByTestId('t-chart'), dots[1].x);
    tapAt(getByTestId('t-chart'), dots[1].x);
    expect(getByTestId('t-readout').props.children).toBe('Latest, Oct 20: 64 bpm');
    expect(pick(getByTestId(`t-dot-${dots[1].index}`), 'width')).toBe(12);
  });

  it('moves to another day when that is tapped', () => {
    const { getByTestId } = show();
    const dots = trendGeometry(RHR().points, 300, 84).dots;
    tapAt(getByTestId('t-chart'), dots[1].x);
    tapAt(getByTestId('t-chart'), dots[2].x);
    expect(getByTestId('t-readout').props.children).toBe('Oct 19: 66 bpm');
    expect(pick(getByTestId(`t-dot-${dots[1].index}`), 'width')).toBe(12);
    expect(pick(getByTestId(`t-dot-${dots[2].index}`), 'width')).toBe(18);
  });

  it('does nothing when the press does not say where it was', () => {
    const { getByTestId } = show();
    fireEvent.press(getByTestId('t-chart'));
    fireEvent.press(getByTestId('t-chart'), { nativeEvent: {} });
    fireEvent.press(getByTestId('t-chart'), { nativeEvent: { locationX: 'left' } });
    expect(getByTestId('t-readout').props.children).toBe('Latest, Oct 20: 64 bpm');
  });

  it('lets go of the day when the period changes to one without it', () => {
    const { getByTestId, rerender } = show();
    const dots = trendGeometry(RHR().points, 300, 84).dots;
    tapAt(getByTestId('t-chart'), dots[0].x); // Oct 14
    expect(getByTestId('t-readout').props.children).toBe('Oct 14: 60 bpm');
    rerender(<TrendChart testID="t" title="Resting heart rate" series={seriesOf([[-2, 61], [0, 59]], 3)} unit="bpm" width={300} height={84} />);
    expect(getByTestId('t-readout').props.children).toBe('Latest, Oct 20: 59 bpm');
  });

  it('can be read by a screen reader without tapping: the label lists every reading', () => {
    const { getByTestId } = show();
    const chart = getByTestId('t-chart');
    expect(chart.props.accessibilityRole).toBe('button');
    expect(chart.props.accessibilityLabel).toBe(
      'Resting heart rate, last 7 days. Average 63 bpm, 4 of 7 days. Oct 14 60 bpm, Oct 17 62 bpm, Oct 19 66 bpm, Oct 20 64 bpm.',
    );
    expect(chart.props.accessibilityHint).toBe('Tap to read the reading for a day');
  });
});

describe('a reading with no history', () => {
  const none = (props = {}) => show({ series: seriesOf([]), ...props });

  it('says so, with a dash for the average, and draws no chart', () => {
    const { getByTestId, queryByTestId, queryByText, UNSAFE_queryAllByType } = none();
    expect(getByTestId('t-average').props.children).toBe(String.fromCharCode(8212));
    expect(getByTestId('t-empty').props.children).toBe('No readings in the last 7 days');
    expect(queryByTestId('t-chart')).toBeNull();
    expect(queryByTestId('t-readout')).toBeNull();
    expect(queryByText('Today')).toBeNull();
    expect(queryByText(/average/)).toBeNull();
    expect(UNSAFE_queryAllByType('Path')).toHaveLength(0);
  });

  it('names what is missing in the words it is given', () => {
    expect(none({ emptyNoun: 'weigh-ins' }).getByTestId('t-empty').props.children).toBe('No weigh-ins in the last 7 days');
    expect(none({ series: seriesOf([], 28) }).getByTestId('t-empty').props.children).toBe('No readings in the last 28 days');
  });

  it('does not break with no series at all', () => {
    const { getByTestId } = render(<TrendChart testID="t" title="Sleep" series={null} />);
    expect(getByTestId('t-empty').props.children).toBe('No readings in the last 0 days');
  });
});

describe('trendSummary', () => {
  it('lists the readings with their units', () => {
    expect(trendSummary({ title: 'Weight', series: seriesOf([[-1, 176.4], [0, 176.1]]), unit: 'lb', decimals: 1, emptyNoun: 'weigh-ins' }))
      .toBe('Weight, last 7 days. Average 176.3 lb, 2 of 7 days. Oct 19 176.4 lb, Oct 20 176.1 lb.');
  });

  it('says when there is nothing', () => {
    expect(trendSummary({ title: 'Sleep', series: seriesOf([], 28), unit: 'h', decimals: 1, emptyNoun: 'readings' }))
      .toBe('Sleep. No readings in the last 28 days.');
    expect(trendSummary({ title: 'Sleep', series: null, emptyNoun: 'readings' })).toBe('Sleep. No readings in the last 0 days.');
  });
});
