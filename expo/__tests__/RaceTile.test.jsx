import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import RaceTile from '../components/RaceTile';

const textOf = (node) => [].concat(node.props.children).join('');
const tile = (props) => render(<RaceTile icon="map-outline" title="Inca Trail" subtitle="43 km · 4 milestones" testID="t" {...props} />);
const fillWidth = (utils) => StyleSheet.flatten(utils.getByTestId('t-fill').props.style).width;

describe('RaceTile', () => {
  it('shows the icon, the name and the line under it', () => {
    const utils = tile({});
    expect(utils.UNSAFE_getByType('Ionicons').props.name).toBe('map-outline');
    expect(utils.getByText('Inca Trail').props.numberOfLines).toBe(1);
    expect(utils.getByText('43 km · 4 milestones').props.numberOfLines).toBe(2);
  });

  it('is a button that says what it is to a screen reader, and opens when pressed', () => {
    const onPress = jest.fn();
    const utils = tile({ onPress, accessibilityLabel: 'Inca Trail. 43 km.' });
    const card = utils.getByTestId('t');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Inca Trail. 43 km.');
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is 160 wide unless told otherwise', () => {
    expect(StyleSheet.flatten(tile({}).getByTestId('t').props.style).width).toBe(160);
    expect(StyleSheet.flatten(tile({ width: 233 }).getByTestId('t').props.style).width).toBe(233);
  });

  it('leaves 14 to its right, which is the gap the Virtual Races page counts on to fit two a row', () => {
    expect(StyleSheet.flatten(tile({}).getByTestId('t').props.style).marginRight).toBe(14);
  });

  it('has a label on the picture only when it has something to say', () => {
    expect(tile({}).queryByTestId('t-label')).toBeNull();
    expect(tile({ label: '' }).queryByTestId('t-label')).toBeNull();
    const utils = tile({ label: 'Joined' });
    expect(textOf(utils.getByTestId('t-label'))).toBe('Joined');
    expect(utils.getByTestId('t-label').props.numberOfLines).toBe(1);
  });

  it('lets the label be found under another id', () => {
    const utils = tile({ label: 'Joined', labelTestID: 'status' });
    expect(textOf(utils.getByTestId('status'))).toBe('Joined');
    expect(utils.queryByTestId('t-label')).toBeNull();
  });

  describe('the bar along the foot', () => {
    it('is not there without progress', () => {
      expect(tile({}).queryByTestId('t-fill')).toBeNull();
      expect(tile({ progress: null }).queryByTestId('t-fill')).toBeNull();
    });

    it('is there, and empty, at no progress', () => {
      expect(fillWidth(tile({ progress: 0 }))).toBe('0%');
    });

    it('is as full as the progress, to the whole per cent', () => {
      expect(fillWidth(tile({ progress: 0.5 }))).toBe('50%');
      expect(fillWidth(tile({ progress: 0.666 }))).toBe('67%');
      expect(fillWidth(tile({ progress: 1 }))).toBe('100%');
    });

    it('never goes past either end', () => {
      expect(fillWidth(tile({ progress: 1.7 }))).toBe('100%');
      expect(fillWidth(tile({ progress: -0.3 }))).toBe('0%');
    });
  });
});
