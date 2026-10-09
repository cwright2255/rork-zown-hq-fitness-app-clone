import React from 'react';
import { render, within } from '@testing-library/react-native';

import PaceLineChart from '../components/PaceLineChart';
import { splitSummary } from '../lib/runDetail';

const rowsOf = (splits, distance, duration) =>
  splitSummary({ splits, distance: distance ?? splits.length, duration: duration ?? splits.reduce((a, b) => a + b, 0) }).rows;

const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
const pick = (node, key) => flat(node).find((s) => s[key] !== undefined)?.[key];

describe('PaceLineChart', () => {
  it('draws nothing when there are no kilometres', () => {
    const utils = render(<PaceLineChart rows={[]} />);
    expect(utils.queryByTestId('pace-chart')).toBeNull();
  });

  it('draws a dot for every kilometre and a label under each', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300, 310, 305, 320, 295])} width={300} height={120} />);
    for (let i = 0; i < 5; i += 1) {
      expect(utils.getByTestId(`pace-point-${i}`)).toBeTruthy();
      expect(utils.getByTestId(`pace-label-${i}`)).toBeTruthy();
    }
    expect(utils.getByTestId('pace-label-0').props.children).toBe('1');
  });

  it('puts the pace of the fastest kilometre in a black label over its dot', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300, 310, 305, 320, 295])} width={300} height={120} />);
    const best = utils.getByTestId('pace-chart-best');
    expect(within(best).getByText('4:55')).toBeTruthy();
    expect(pick(best, 'backgroundColor')).toBe('#000000');
    // the label sits above the dot
    expect(pick(best, 'top')).toBeLessThan(pick(utils.getByTestId('pace-point-4'), 'top'));
  });

  it('shows no label for the fastest when every kilometre was the same', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300, 300, 300])} width={300} height={120} />);
    expect(utils.queryByTestId('pace-chart-best')).toBeNull();
  });

  it('keeps the labels inside the chart at both ends', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300, 310, 295])} width={200} height={120} />);
    ['pace-label-0', 'pace-label-2'].forEach((id) => {
      const left = pick(utils.getByTestId(id), 'left');
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + 36).toBeLessThanOrEqual(200);
    });
    const bubbleLeft = pick(utils.getByTestId('pace-chart-best'), 'left');
    expect(bubbleLeft).toBeGreaterThanOrEqual(0);
    expect(bubbleLeft + 52).toBeLessThanOrEqual(200);
  });

  it('is black and white only', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300, 310, 305, 320, 295])} />);
    expect(JSON.stringify(utils.toJSON())).not.toMatch(/22C55E|34, ?197, ?94/i);
  });

  it('draws a single kilometre as one dot with no line', () => {
    const utils = render(<PaceLineChart rows={rowsOf([300], 1, 300)} width={300} height={120} />);
    expect(utils.getByTestId('pace-point-0')).toBeTruthy();
    expect(utils.queryByTestId('pace-chart-best')).toBeNull();
  });
});
