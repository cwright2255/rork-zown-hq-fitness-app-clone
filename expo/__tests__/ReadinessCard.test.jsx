// The Readiness card (components/ReadinessCard.jsx): the score and its band, a row for each of the four things it is made from, and the
// formula in words; the same rows with what is missing before there is a score; nothing with no readings at all.
import React from 'react';
import { render, within } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import ReadinessCard, { NOT_READY_TEXT } from '../components/ReadinessCard';
import { computeReadiness, READINESS_FORMULA } from '../lib/readiness';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);
const DASH = String.fromCharCode(8212);
const LOAD = { zone: 'sweet_spot', ratio: 1, zoneLabel: 'In your typical training range', acuteLoad: 2000, chronicWeeklyAvg: 2000 };

const history = (today = {}, days = 28) => {
  const out = {};
  for (let i = 1; i <= days; i += 1) out[day(-i)] = { hrv: 50, restingHeartRate: 60 };
  out[TODAY] = today;
  return out;
};
const readinessOf = (today, trainingLoad = LOAD, days = 28) => computeReadiness({ history: history(today, days), today: TODAY, trainingLoad });
const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
const pick = (node, key) => [...flat(node)].reverse().find((s) => s[key] !== undefined)?.[key];

describe('with nothing to show', () => {
  it('draws nothing without readiness, or with no readings at all', () => {
    expect(render(<ReadinessCard readiness={null} />).toJSON()).toBeNull();
    expect(render(<ReadinessCard readiness={undefined} />).toJSON()).toBeNull();
    expect(render(<ReadinessCard readiness={computeReadiness({ history: {}, today: TODAY })} />).toJSON()).toBeNull();
  });
});

describe('with a score', () => {
  const good = () => render(<ReadinessCard readiness={readinessOf({ hrv: 55, restingHeartRate: 57, sleepHours: 7 })} />);

  it('shows the score out of 100, its band, and how many readings it is made from', () => {
    const { getByTestId, getByText, queryByTestId } = good();
    expect(getByText('Readiness')).toBeTruthy();
    expect(getByTestId('readiness-score').props.children).toBe('94');
    expect(getByTestId('readiness-label').props.children).toBe('High');
    expect(getByTestId('readiness-basis').props.children).toBe('Out of 100, made from 4 of 4 readings');
    expect(queryByTestId('readiness-not-ready')).toBeNull();
  });

  it('can be read out as one sentence', () => {
    const { getByLabelText } = good();
    expect(getByLabelText('Readiness 94 out of 100, High')).toBeTruthy();
  });

  it('marks the band with a dot as well as the word', () => {
    expect(pick(good().getByTestId('readiness-dot'), 'backgroundColor')).toBe('#22C55E');
    const moderate = render(<ReadinessCard readiness={readinessOf({ hrv: 50, restingHeartRate: 60, sleepHours: 6 })} />);
    expect(moderate.getByTestId('readiness-label').props.children).toBe('Moderate');
    expect(pick(moderate.getByTestId('readiness-dot'), 'backgroundColor')).toBe('#D97706');
    const low = render(<ReadinessCard readiness={readinessOf({ hrv: 38, restingHeartRate: 66, sleepHours: 5 }, { ...LOAD, ratio: 1.75 })} />);
    expect(low.getByTestId('readiness-label').props.children).toBe('Low');
    expect(pick(low.getByTestId('readiness-dot'), 'backgroundColor')).toBe('#DC2626');
  });

  it('has a row for each of the four things, in order, with what was read, its score and its weight', () => {
    const { getByTestId } = good();
    const expected = [
      ['hrv', 'HRV', '55 ms today, 50 ms usual (+10%)', '100', 'x35'],
      ['restingHeartRate', 'Resting heart rate', '57 bpm today, 60 bpm usual (-5%)', '100', 'x25'],
      ['sleep', 'Sleep', '7.0 h last night (8 h scores 100)', '75', 'x25'],
      ['load', 'Training load', '1.00 this week against your usual week', '100', 'x15'],
    ];
    for (const [key, title, detail, score, weight] of expected) {
      const row = getByTestId(`readiness-row-${key}`);
      expect(within(row).getByText(title)).toBeTruthy();
      expect(getByTestId(`readiness-detail-${key}`).props.children).toBe(detail);
      expect(getByTestId(`readiness-part-score-${key}`).props.children).toBe(score);
      expect(getByTestId(`readiness-weight-${key}`).props.children).toBe(weight);
    }
    const order = JSON.stringify(good().toJSON());
    const at = (key) => order.indexOf(`"testID":"readiness-row-${key}"`);
    expect(at('hrv')).toBeLessThan(at('restingHeartRate'));
    expect(at('restingHeartRate')).toBeLessThan(at('sleep'));
    expect(at('sleep')).toBeLessThan(at('load'));
  });

  it('shows the formula in words', () => {
    expect(good().getByTestId('readiness-formula').props.children).toBe(READINESS_FORMULA);
  });

  it('shows a dash, with no weight, for a part that has no reading, and counts only the rest', () => {
    const { getByTestId, queryByTestId } = render(<ReadinessCard readiness={readinessOf({ hrv: 55, sleepHours: 8 }, null)} />);
    expect(getByTestId('readiness-basis').props.children).toBe('Out of 100, made from 2 of 4 readings');
    expect(getByTestId('readiness-part-score-restingHeartRate').props.children).toBe(DASH);
    expect(getByTestId('readiness-detail-restingHeartRate').props.children).toBe('Waiting for today\'s reading');
    expect(queryByTestId('readiness-weight-restingHeartRate')).toBeNull();
    expect(getByTestId('readiness-part-score-load').props.children).toBe(DASH);
    expect(getByTestId('readiness-detail-load').props.children).toBe('Needs about a week of workouts, runs or hikes');
    expect(queryByTestId('readiness-weight-load')).toBeNull();
  });
});

describe('before there is a score', () => {
  it('says what it is waiting for and shows no number, with the rows showing how far along each part is', () => {
    const { getByTestId, queryByTestId } = render(<ReadinessCard readiness={readinessOf({ sleepHours: 8 }, LOAD, 6)} />);
    expect(getByTestId('readiness-not-ready').props.children).toBe(NOT_READY_TEXT);
    expect(queryByTestId('readiness-score')).toBeNull();
    expect(queryByTestId('readiness-label')).toBeNull();
    expect(queryByTestId('readiness-basis')).toBeNull();
    expect(getByTestId('readiness-detail-hrv').props.children).toBe('Needs about two weeks of readings to compare with (6 of 10 so far)');
    expect(getByTestId('readiness-detail-restingHeartRate').props.children).toBe('Needs about two weeks of readings to compare with (6 of 10 so far)');
    expect(getByTestId('readiness-part-score-sleep').props.children).toBe('100'); // 8 hours of sleep
    expect(getByTestId('readiness-formula')).toBeTruthy();
  });

  it('says what the screen is waiting for in plain words', () => {
    expect(NOT_READY_TEXT).toBe('Readiness appears once two of HRV, resting heart rate and sleep have a reading today, and HRV and resting heart rate '
      + 'have about two weeks of earlier readings to compare with.');
  });
});
