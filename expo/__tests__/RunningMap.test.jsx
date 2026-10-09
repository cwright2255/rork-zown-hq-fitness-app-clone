import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  const mockCalls = { animateCamera: jest.fn(), animateToRegion: jest.fn() };
  const MapView = mockReact.forwardRef((props, ref) => {
    mockReact.useImperativeHandle(ref, () => mockCalls);
    return mockReact.createElement(mockRn.View, { testID: 'map' }, props.children);
  });
  const Polyline = () => null;
  const Marker = (props) => mockReact.createElement(mockRn.View, null, props.children);
  return { __esModule: true, default: MapView, MapView, Polyline, Marker, PROVIDER_DEFAULT: null, __calls: mockCalls };
});

import RunningMap from '../components/RunningMap';

const Maps = require('react-native-maps');

const p = (n) => ({ latitude: 40 + n * 0.001, longitude: -74 - n * 0.001 });
const line = (n) => Array.from({ length: n }, (_, i) => p(i));

const mapProps = (utils) => utils.UNSAFE_getByType(Maps.MapView).props;
const polylines = (utils) => utils.UNSAFE_queryAllByType(Maps.Polyline);
const markers = (utils) => utils.UNSAFE_queryAllByType(Maps.Marker);

describe('RunningMap (native)', () => {
  beforeEach(() => {
    Maps.__calls.animateCamera.mockClear();
    Maps.__calls.animateToRegion.mockClear();
  });

  it('uses the dark, muted map without shop pins', () => {
    const utils = render(<RunningMap coordinates={[]} currentLocation={null} />);
    const props = mapProps(utils);
    expect(props.userInterfaceStyle).toBe('dark');
    expect(props.mapType).toBe('mutedStandard');
    expect(props.showsPointsOfInterest).toBe(false);
    expect(props.showsUserLocation).toBe(true);
  });

  it('draws no route until there are two points', () => {
    const utils = render(<RunningMap coordinates={line(1)} currentLocation={p(0)} />);
    expect(polylines(utils)).toHaveLength(0);
  });

  it('draws the route as a glow under a white line', () => {
    const utils = render(<RunningMap coordinates={line(5)} currentLocation={p(4)} />);
    const lines = polylines(utils);
    expect(lines).toHaveLength(2);
    const [glow, route] = lines.map((l) => l.props);
    expect(route.strokeColor).toBe('#FFFFFF');
    expect(glow.strokeColor).toBe('rgba(255, 255, 255, 0.28)');
    expect(glow.strokeWidth > route.strokeWidth).toBe(true);
    expect(glow.zIndex < route.zIndex).toBe(true);
    expect(route.coordinates).toHaveLength(5);
  });

  it('marks the start of the run, and has no second blue dot', () => {
    const utils = render(<RunningMap coordinates={line(5)} currentLocation={p(4)} />);
    const all = markers(utils);
    expect(all).toHaveLength(1);
    expect(all[0].props.coordinate).toEqual(p(0));
  });

  it('marks the start with an open ring, so the position dot can be seen inside it', () => {
    const utils = render(<RunningMap coordinates={line(5)} currentLocation={p(4)} />);
    const ring = utils.getByTestId('run-map-start');
    expect(ring).toBeTruthy();
    const inner = ring.children[0];
    const flat = [].concat(inner.props.style).flat().filter(Boolean);
    expect(flat.some((st) => st.borderColor === '#FFFFFF' && st.borderWidth === 3)).toBe(true);
    expect(flat.some((st) => st.backgroundColor)).toBe(false);
  });

  it('uses no green anywhere on the map', () => {
    const utils = render(<RunningMap coordinates={line(5)} currentLocation={p(4)} />);
    expect(JSON.stringify(utils.toJSON())).not.toMatch(/22C55E|34, ?197, ?94/i);
  });

  it('zooms in on the first fix, then only moves the centre', () => {
    const utils = render(<RunningMap coordinates={[]} currentLocation={null} />);
    expect(Maps.__calls.animateToRegion).not.toHaveBeenCalled();

    utils.rerender(<RunningMap coordinates={line(1)} currentLocation={p(0)} />);
    expect(Maps.__calls.animateToRegion).toHaveBeenCalledTimes(1);
    expect(Maps.__calls.animateToRegion.mock.calls[0][0].latitudeDelta).toBe(0.004);
    expect(Maps.__calls.animateCamera).not.toHaveBeenCalled();

    utils.rerender(<RunningMap coordinates={line(2)} currentLocation={p(1)} />);
    expect(Maps.__calls.animateToRegion).toHaveBeenCalledTimes(1);
    expect(Maps.__calls.animateCamera).toHaveBeenCalledTimes(1);
    const camera = Maps.__calls.animateCamera.mock.calls[0][0];
    expect(camera.center).toEqual(p(1));
    expect(camera.zoom).toBeUndefined();
  });

  it('stops following when the map is dragged and shows the re-center button', () => {
    const utils = render(<RunningMap coordinates={line(2)} currentLocation={p(1)} />);
    expect(utils.queryByTestId('recenter-button')).toBeNull();

    act(() => { mapProps(utils).onPanDrag({}); });
    expect(utils.getByTestId('recenter-button')).toBeTruthy();

    Maps.__calls.animateCamera.mockClear();
    utils.rerender(<RunningMap coordinates={line(3)} currentLocation={p(2)} />);
    expect(Maps.__calls.animateCamera).not.toHaveBeenCalled();
  });

  it('follows again after the re-center button is pressed', () => {
    const utils = render(<RunningMap coordinates={line(2)} currentLocation={p(1)} />);
    act(() => { mapProps(utils).onPanDrag({}); });
    utils.rerender(<RunningMap coordinates={line(3)} currentLocation={p(2)} />);
    Maps.__calls.animateCamera.mockClear();

    fireEvent.press(utils.getByTestId('recenter-button'));
    expect(utils.queryByTestId('recenter-button')).toBeNull();
    expect(Maps.__calls.animateCamera).toHaveBeenCalledTimes(1);
    expect(Maps.__calls.animateCamera.mock.calls[0][0].center).toEqual(p(2));
  });
});
