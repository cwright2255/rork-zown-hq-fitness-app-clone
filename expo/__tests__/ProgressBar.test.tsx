import React from 'react';
import { render } from '@testing-library/react-native';
import { ProgressBar } from '../src/components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('exposes accessibilityValue', () => {
    const { getByRole } = render(<ProgressBar value={42} />);
    const bar = getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });

  it('clamps value below min', () => {
    const { getByRole } = render(<ProgressBar value={-10} />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });

  it('clamps value above max', () => {
    const { getByRole } = render(<ProgressBar value={150} />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });
});
