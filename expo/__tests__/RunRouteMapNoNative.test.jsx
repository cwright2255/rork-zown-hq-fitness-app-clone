import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
// A build without native maps: requiring the package fails.
jest.mock('react-native-maps', () => {
  throw new Error('react-native-maps is not available');
});

import RunRouteMap from '../components/RunRouteMap';

const p = (n) => ({ latitude: 40 + n * 0.001, longitude: -74 - n * 0.001 });
const line = (n) => Array.from({ length: n }, (_, i) => p(i));

describe('RunRouteMap without native maps', () => {
  it('draws the route as a flat sketch instead of crashing', () => {
    const utils = render(<RunRouteMap points={line(6)} />);
    expect(utils.getByTestId('run-route-sketch')).toBeTruthy();
    expect(utils.queryByTestId('run-route-map')).toBeNull();
  });

  it('still says so when there is no route', () => {
    const utils = render(<RunRouteMap points={[]} />);
    expect(utils.getByTestId('run-route-empty')).toBeTruthy();
    expect(utils.queryByTestId('run-route-sketch')).toBeNull();
  });
});
