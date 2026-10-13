import React from 'react';
import { render } from '@testing-library/react-native';

// The chart is drawn with SVG, which has no real renderer under Jest, so the SVG parts become plain
// elements whose text can be read. Everything else is the real chart.
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const Plain = ({ children }) => mockReact.createElement(mockRn.View, null, children);
  const Label = ({ children }) => mockReact.createElement(mockRn.Text, null, children);
  return { __esModule: true, default: Plain, Polygon: Plain, Polyline: Plain, Line: Plain, Text: Label };
});

import ElevationProfileChart from '../components/ElevationProfileChart';

// A 6.4 km out-and-back climb from 100 m to 340 m.
const PROFILE = [
  { distanceKm: 0, elevationM: 100 },
  { distanceKm: 3.2, elevationM: 340 },
  { distanceKm: 6.4, elevationM: 120 },
];

describe('ElevationProfileChart distance axis', () => {
  it('is labelled in kilometres by default and for metric', () => {
    const none = render(<ElevationProfileChart profile={PROFILE} />);
    expect(none.getByText('0 km')).toBeTruthy();
    expect(none.getByText('6.4 km')).toBeTruthy();
    const metric = render(<ElevationProfileChart profile={PROFILE} units="metric" />);
    expect(metric.getByText('6.4 km')).toBeTruthy();
  });

  it('is labelled in miles for imperial, and the elevation stays in metres', () => {
    const utils = render(<ElevationProfileChart profile={PROFILE} units="imperial" />);
    expect(utils.getByText('0 mi')).toBeTruthy();
    expect(utils.getByText('4.0 mi')).toBeTruthy(); // 6.4 km
    expect(utils.queryByText(/ km$/)).toBeNull();
    expect(utils.getByText(/100.340 m/)).toBeTruthy();
  });

  it('draws nothing for a profile with fewer than two points', () => {
    expect(render(<ElevationProfileChart profile={[PROFILE[0]]} units="imperial" />).toJSON()).toBeNull();
  });
});
