// The Health page's Trends section (components/HealthTrends.jsx): sleep, HRV, resting heart rate and weight over 7 or 28 days.
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }), { virtual: true });

import HealthTrends, { TREND_RANGES } from '../components/HealthTrends';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);
const DASH = String.fromCharCode(8212);

// Resting heart rate on three days this week and three days the week before; sleep and HRV on days in the 28.
const HISTORY = {
  [day(-1)]: { restingHeartRate: 58, hrv: 44, sleepHours: 7.2 },
  [day(0)]: { restingHeartRate: 60, hrv: 46, sleepHours: 6.8 },
  [day(-3)]: { restingHeartRate: 62 },
  [day(-9)]: { restingHeartRate: 64, sleepHours: 8 },
  [day(-10)]: { restingHeartRate: 64 },
  [day(-11)]: { restingHeartRate: 64 },
  [day(-20)]: { hrv: 40, sleepHours: 7 },
};
const kg = (offset, weightKg) => ({ id: `w${offset}`, weightKg, createdAtLocal: new Date(2026, 9, 20 + offset, 8).toISOString() });

const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
const pick = (node, key) => [...flat(node)].reverse().find((s) => s[key] !== undefined)?.[key];

const show = (props = {}) => render(<HealthTrends history={HISTORY} weightLogs={[kg(-2, 80)]} today={TODAY} {...props} />);

describe('the four cards', () => {
  it('are sleep, HRV, resting heart rate and weight, in that order, for the last 7 days to begin with', () => {
    const { getAllByText } = show();
    expect(getAllByText('7-day average')).toHaveLength(4);
    const text = JSON.stringify(show().toJSON());
    const at = (testID) => text.indexOf(`"testID":"${testID}"`);
    expect(at('trend-sleep')).toBeGreaterThan(-1);
    expect(at('trend-sleep')).toBeLessThan(at('trend-hrv'));
    expect(at('trend-hrv')).toBeLessThan(at('trend-restingHeartRate'));
    expect(at('trend-restingHeartRate')).toBeLessThan(at('trend-weight'));
    for (const title of ['Sleep', 'Resting heart rate', 'Weight']) expect(show().getByText(title)).toBeTruthy();
  });

  it('show the week average of each reading with its unit', () => {
    const { getByTestId } = show();
    expect(getByTestId('trend-sleep-average').props.children).toBe('7.0 h');
    expect(getByTestId('trend-hrv-average').props.children).toBe('45 ms');
    expect(getByTestId('trend-restingHeartRate-average').props.children).toBe('60 bpm');
    expect(getByTestId('trend-weight-average').props.children).toBe('176.4 lb');
  });

  it('say how many days of the week each has', () => {
    const { getByTestId } = show();
    expect(getByTestId('trend-sleep-coverage').props.children).toBe('2 of 7 days');
    expect(getByTestId('trend-restingHeartRate-coverage').props.children).toBe('3 of 7 days  \u00B7  -4 bpm vs the 7 days before');
    expect(getByTestId('trend-weight-coverage').props.children).toBe('1 of 7 days');
  });

  it('call HRV by the name it is given', () => {
    expect(show({ hrvLabel: 'HRV (SDNN)' }).getByText('HRV (SDNN)')).toBeTruthy();
    expect(show().getByText('HRV')).toBeTruthy();
  });
});

describe('weight', () => {
  it('is in pounds by default and in kilograms when asked', () => {
    expect(show().getByTestId('trend-weight-average').props.children).toBe('176.4 lb');
    expect(show({ pounds: false }).getByTestId('trend-weight-average').props.children).toBe('80.0 kg');
  });

  it('takes the last weight logged each day', () => {
    const logs = [kg(-2, 80), { ...kg(-2, 79), createdAtLocal: new Date(2026, 9, 18, 20).toISOString() }];
    expect(show({ weightLogs: logs, pounds: false }).getByTestId('trend-weight-average').props.children).toBe('79.0 kg');
  });

  it('is called weigh-ins when there are none', () => {
    expect(show({ weightLogs: [] }).getByTestId('trend-weight-empty').props.children).toBe('No weigh-ins in the last 7 days');
    expect(show({ weightLogs: null }).getByTestId('trend-weight-empty').props.children).toBe('No weigh-ins in the last 7 days');
  });
});

describe('the 7 and 28 day switch', () => {
  it('has two buttons, with 7 days picked first', () => {
    const { getByTestId } = show();
    expect(TREND_RANGES.map((r) => r.days)).toEqual([7, 28]);
    expect(getByTestId('trends-range-7').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('trends-range-28').props.accessibilityState).toEqual({ selected: false });
    expect(getByTestId('trends-range-7').props.accessibilityRole).toBe('button');
    expect(getByTestId('trends-range-28').props.accessibilityLabel).toBe('Show the last 28 days');
  });

  it('reads 7 days and 28 days', () => {
    const { getByText, getByTestId } = show();
    expect(getByText('7 days')).toBeTruthy();
    expect(getByText('28 days')).toBeTruthy();
    expect(getByTestId('trends-range-7').props.accessibilityLabel).toBe('Show the last 7 days');
  });

  it('shows white on black for the picked one and dark on light for the other', () => {
    const { getByTestId, getByText } = show();
    expect(pick(getByTestId('trends-range-7'), 'backgroundColor')).toBe('#000000');
    expect(pick(getByTestId('trends-range-28'), 'backgroundColor')).toBeUndefined();
    expect(pick(getByText('7 days'), 'color')).toBe('#FFFFFF');
    expect(pick(getByText('28 days'), 'color')).toBe('#444444');
    fireEvent.press(getByTestId('trends-range-28'));
    expect(pick(getByTestId('trends-range-28'), 'backgroundColor')).toBe('#000000');
    expect(pick(getByTestId('trends-range-7'), 'backgroundColor')).toBeUndefined();
    expect(pick(getByText('28 days'), 'color')).toBe('#FFFFFF');
    expect(pick(getByText('7 days'), 'color')).toBe('#444444');
  });

  it('are big enough to hit: at least 40 tall, with a little more around them', () => {
    const { getByTestId } = show();
    for (const id of ['trends-range-7', 'trends-range-28']) {
      expect(pick(getByTestId(id), 'minHeight')).toBe(40);
      expect(getByTestId(id).props.hitSlop).toBe(4);
    }
  });

  it('changes all four cards to the last 28 days', () => {
    const { getByTestId, getAllByText, queryByText } = show();
    fireEvent.press(getByTestId('trends-range-28'));
    expect(getAllByText('28-day average')).toHaveLength(4);
    expect(queryByText('7-day average')).toBeNull();
    expect(getByTestId('trends-range-28').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('trend-sleep-coverage').props.children).toBe('4 of 28 days');
    expect(getByTestId('trend-sleep-average').props.children).toBe('7.3 h'); // 7.2, 6.8, 8 and 7
    expect(getByTestId('trend-hrv-average').props.children).toBe('43 ms'); // 44, 46 and 40
    expect(getByTestId('trend-restingHeartRate-coverage').props.children).toBe('6 of 28 days');
  });

  it('goes back to 7 days', () => {
    const { getByTestId, getAllByText } = show();
    fireEvent.press(getByTestId('trends-range-28'));
    fireEvent.press(getByTestId('trends-range-7'));
    expect(getAllByText('7-day average')).toHaveLength(4);
  });
});

describe('with no readings', () => {
  it('says so on each card, for the period picked, and shows nothing made up', () => {
    const { getByTestId, queryByText, queryAllByText } = show({ history: {}, weightLogs: [] });
    for (const id of ['trend-sleep', 'trend-hrv', 'trend-restingHeartRate']) {
      expect(getByTestId(`${id}-empty`).props.children).toBe('No readings in the last 7 days');
      expect(getByTestId(`${id}-average`).props.children).toBe(DASH);
    }
    expect(getByTestId('trend-weight-empty').props.children).toBe('No weigh-ins in the last 7 days');
    expect(queryByText(/average/)).toBeNull();
    fireEvent.press(getByTestId('trends-range-28'));
    expect(queryAllByText(/in the last 28 days/)).toHaveLength(4);
  });

  it('copes with a history that is missing or not an object', () => {
    for (const history of [undefined, null, 'x', []]) {
      expect(show({ history }).getByTestId('trend-sleep-empty')).toBeTruthy();
    }
  });
});

describe('the day it counts back from', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('is the day it is told', () => {
    const { getByTestId } = show({ today: day(1) });
    expect(getByTestId('trend-sleep-coverage').props.children).toBe('2 of 7 days');
    const later = show({ today: day(10) });
    expect(later.getByTestId('trend-sleep-empty')).toBeTruthy();
  });

  it('is today, in the person\'s own time, when it is not told', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 20, 23, 30));
    const { getByTestId } = render(<HealthTrends history={HISTORY} weightLogs={[]} />);
    expect(getByTestId('trend-sleep-readout').props.children).toBe('Latest, Oct 20: 6.8 h');
  });
});

describe('the width of the charts', () => {
  const widthOf = (utils) => pick(utils.getByTestId('trend-sleep-chart'), 'width');
  const measure = (utils, width) => act(() => { fireEvent(utils.getByTestId('health-trends'), 'layout', { nativeEvent: { layout: { width } } }); });

  it('is 300 until the section has been measured', () => {
    expect(widthOf(show())).toBe(300);
  });

  it('fits the section, less the padding of the card', () => {
    const utils = show();
    measure(utils, 350);
    expect(widthOf(utils)).toBe(318);
    measure(utils, 390.4);
    expect(widthOf(utils)).toBe(358);
  });

  it('is never narrower than 160', () => {
    const utils = show();
    measure(utils, 120);
    expect(widthOf(utils)).toBe(160);
    measure(utils, 0);
    expect(widthOf(utils)).toBe(300);
  });
});
