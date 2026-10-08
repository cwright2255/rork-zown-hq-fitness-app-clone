import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('../components/RunRouteMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__routeProps = props;
      return mockReact.createElement(mockRn.View, { testID: 'route-map' });
    },
    hasNativeMap: () => global.__hasNativeMap,
  };
});

import RunPostCard from '../components/RunPostCard';

const shared = (extra = {}) => ({
  v: 1, activity: 'run', title: 'Morning Run', distance: 5.23, duration: 1610, pace: 308,
  route: [40.002, -74, 40.01, -74, 40.018, -74], elevGain: 42, ...extra,
});

beforeEach(() => {
  global.__hasNativeMap = true;
  global.__routeProps = null;
});

describe('RunPostCard', () => {
  it('shows the title and the distance, time and pace', () => {
    const utils = render(<RunPostCard run={shared()} />);
    expect(utils.getByTestId('run-post-title').props.children).toBe('Morning Run');
    expect(utils.getByTestId('run-post-distance').props.children).toEqual(['5.23', expect.anything()]);
    expect(utils.getByTestId('run-post-time').props.children).toEqual(['26:50', null]);
    expect(utils.getByTestId('run-post-pace').props.children).toEqual(['5:08', expect.anything()]);
    expect(utils.getByText('Distance')).toBeTruthy();
    expect(utils.getByText('Pace')).toBeTruthy();
  });

  it('shows the climb only when there was one', () => {
    expect(render(<RunPostCard run={shared()} />).getByTestId('run-post-climb').props.children).toBe('42 m climb');
    expect(render(<RunPostCard run={shared({ elevGain: 0 })} />).queryByTestId('run-post-climb')).toBeNull();
  });

  it('draws the route as a sketch by default and says the ends are hidden', () => {
    const utils = render(<RunPostCard run={shared()} />);
    expect(global.__routeProps.sketch).toBe(true);
    expect(global.__routeProps.points).toEqual([
      { latitude: 40.002, longitude: -74 },
      { latitude: 40.01, longitude: -74 },
      { latitude: 40.018, longitude: -74 },
    ]);
    expect(utils.getByTestId('run-post-privacy').props.children).toBe('First and last 200 m hidden');
  });

  it('opens the real map for this one card, and closes it again', () => {
    const utils = render(<RunPostCard run={shared()} />);
    expect(utils.getByText('View on map')).toBeTruthy();
    fireEvent.press(utils.getByTestId('run-post-map-toggle'));
    expect(global.__routeProps.sketch).toBe(false);
    expect(utils.getByText('Hide map')).toBeTruthy();
    fireEvent.press(utils.getByTestId('run-post-map-toggle'));
    expect(global.__routeProps.sketch).toBe(true);
  });

  it('offers no map button in a build with no native map', () => {
    global.__hasNativeMap = false;
    const utils = render(<RunPostCard run={shared()} />);
    expect(utils.queryByTestId('run-post-map-toggle')).toBeNull();
    expect(utils.getByTestId('route-map')).toBeTruthy(); // the sketch is still there
  });

  it('shows the numbers with no route or privacy line when the run had no route', () => {
    const utils = render(<RunPostCard run={shared({ route: [] })} />);
    expect(utils.queryByTestId('route-map')).toBeNull();
    expect(utils.queryByTestId('run-post-privacy')).toBeNull();
    expect(utils.queryByTestId('run-post-map-toggle')).toBeNull();
    expect(utils.getByTestId('run-post-distance')).toBeTruthy();
  });

  it('shows a walk as a walk', () => {
    const utils = render(<RunPostCard run={shared({ activity: 'walk', title: 'Evening Walk' })} />);
    expect(utils.getByTestId('run-post-title').props.children).toBe('Evening Walk');
    expect(utils.UNSAFE_getAllByType('Ionicons').some((i) => i.props.name === 'walk-outline')).toBe(true);
  });

  it('shows nothing for a run it cannot read', () => {
    expect(render(<RunPostCard run={{ distance: 0, duration: 0 }} />).queryByTestId('run-post-card')).toBeNull();
    expect(render(<RunPostCard run="oops" />).queryByTestId('run-post-card')).toBeNull();
    expect(render(<RunPostCard run={undefined} />).queryByTestId('run-post-card')).toBeNull();
  });
});
