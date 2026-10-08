import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const mockCalls = { fitToCoordinates: jest.fn() };
  const MapView = mockReact.forwardRef((props, ref) => {
    mockReact.useImperativeHandle(ref, () => mockCalls);
    return mockReact.createElement(mockRn.View, { testID: 'map' }, props.children);
  });
  const Polyline = () => null;
  const Marker = (props) => mockReact.createElement(mockRn.View, null, props.children);
  return { __esModule: true, default: MapView, MapView, Polyline, Marker, PROVIDER_DEFAULT: null, __calls: mockCalls };
});

import RunRouteMap, { hasNativeMap } from '../components/RunRouteMap';

const Maps = require('react-native-maps');

const p = (n) => ({ latitude: 40 + n * 0.001, longitude: -74 - n * 0.001 });
const line = (n) => Array.from({ length: n }, (_, i) => p(i));

const mapProps = (utils) => utils.UNSAFE_getByType(Maps.MapView).props;
const polylines = (utils) => utils.UNSAFE_queryAllByType(Maps.Polyline);
const markers = (utils) => utils.UNSAFE_queryAllByType(Maps.Marker);

describe('RunRouteMap (native)', () => {
  beforeEach(() => Maps.__calls.fitToCoordinates.mockClear());

  it('says so when the run has no route', () => {
    const utils = render(<RunRouteMap points={[]} />);
    expect(utils.getByTestId('run-route-empty')).toBeTruthy();
    expect(utils.getByText('No route was recorded for this run')).toBeTruthy();
    expect(utils.queryByTestId('run-route-map')).toBeNull();
  });

  it('one point is not a route', () => {
    const utils = render(<RunRouteMap points={line(1)} />);
    expect(utils.getByTestId('run-route-empty')).toBeTruthy();
  });

  it('shows the same dark, muted map as the live run, without shop pins', () => {
    const utils = render(<RunRouteMap points={line(5)} />);
    expect(utils.getByTestId('run-route-map')).toBeTruthy();
    const props = mapProps(utils);
    expect(props.userInterfaceStyle).toBe('dark');
    expect(props.mapType).toBe('mutedStandard');
    expect(props.showsPointsOfInterest).toBe(false);
  });

  it('sits still: it can not be dragged, zoomed or turned', () => {
    const props = mapProps(render(<RunRouteMap points={line(5)} />));
    expect(props.scrollEnabled).toBe(false);
    expect(props.zoomEnabled).toBe(false);
    expect(props.rotateEnabled).toBe(false);
    expect(props.pitchEnabled).toBe(false);
  });

  it('draws the route as a glow under a green line', () => {
    const lines = polylines(render(<RunRouteMap points={line(5)} />));
    expect(lines).toHaveLength(2);
    const [glow, route] = lines.map((l) => l.props);
    expect(route.strokeColor).toBe('#22C55E');
    expect(glow.strokeWidth > route.strokeWidth).toBe(true);
    expect(glow.zIndex < route.zIndex).toBe(true);
    expect(route.coordinates).toHaveLength(5);
  });

  it('marks where the run started and where it finished', () => {
    const utils = render(<RunRouteMap points={line(5)} />);
    const all = markers(utils);
    expect(all).toHaveLength(2);
    expect(all[0].props.coordinate).toEqual(p(0));
    expect(all[1].props.coordinate).toEqual(p(4));
    expect(utils.getByTestId('run-route-start')).toBeTruthy();
    expect(utils.getByTestId('run-route-finish')).toBeTruthy();
  });

  it('starts on a region that already holds the whole route', () => {
    const region = mapProps(render(<RunRouteMap points={line(5)} />)).initialRegion;
    expect(region.latitude).toBeCloseTo(40.002, 6);
    expect(region.longitude).toBeCloseTo(-74.002, 6);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.004 * 0.999);
  });

  it('fits the map exactly to the route once it is ready', () => {
    const points = line(5);
    const utils = render(<RunRouteMap points={points} />);
    expect(Maps.__calls.fitToCoordinates).not.toHaveBeenCalled();
    mapProps(utils).onMapReady();
    expect(Maps.__calls.fitToCoordinates).toHaveBeenCalledTimes(1);
    const [coords, options] = Maps.__calls.fitToCoordinates.mock.calls[0];
    expect(coords).toBe(points);
    expect(options.animated).toBe(false);
    expect(options.edgePadding.top).toBeGreaterThan(0);
  });

  it('says a real map is available', () => {
    expect(hasNativeMap()).toBe(true);
  });

  it('draws the flat sketch instead of the map when asked, as the feed does', () => {
    const utils = render(<RunRouteMap points={line(5)} sketch />);
    expect(utils.getByTestId('run-route-sketch')).toBeTruthy();
    expect(utils.queryByTestId('run-route-map')).toBeNull();
  });

  it('fits the route with the room around it that it is given', () => {
    const edgePadding = { top: 30, right: 30, bottom: 30, left: 30 };
    const utils = render(<RunRouteMap points={line(5)} edgePadding={edgePadding} />);
    mapProps(utils).onMapReady();
    expect(Maps.__calls.fitToCoordinates.mock.calls[0][1].edgePadding).toEqual(edgePadding);
  });
});
