// The card the newer Home widgets share (components/HomeWidgetCard.jsx).
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import HomeWidgetCard from '../components/HomeWidgetCard';

const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);

describe('HomeWidgetCard', () => {
  it('draws the label, the number, what goes under it and the caption', () => {
    const utils = render(
      <HomeWidgetCard label="Next Up" icon="calendar-outline" value="5" caption="days in a row">
        <Text>extra</Text>
      </HomeWidgetCard>,
    );
    expect(utils.getByText('Next Up')).toBeTruthy();
    expect(utils.getByText('5')).toBeTruthy();
    expect(utils.getByText('extra')).toBeTruthy();
    expect(utils.getByText('days in a row')).toBeTruthy();
    expect(iconNames(utils)).toEqual(['calendar-outline', 'chevron-forward']);
  });

  it('hands the tap to the touchable itself, once', () => {
    const onPress = jest.fn();
    const utils = render(<HomeWidgetCard label="x" icon="flash-outline" caption="c" onPress={onPress} testID="card" />);
    // The touchable has to carry the handler. (A test that only presses the element would also reach it through the props of the
    // card above it, and pass with nothing wired.)
    expect(utils.UNSAFE_getByType(TouchableOpacity).props.onPress).toBe(onPress);
    fireEvent.press(utils.getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a labelled button for a screen reader', () => {
    const utils = render(<HomeWidgetCard label="x" icon="flash-outline" caption="c" accessibilityLabel="Streak: 5 days" testID="card" />);
    const touch = utils.UNSAFE_getByType(TouchableOpacity);
    expect(touch.props.accessibilityRole).toBe('button');
    expect(touch.props.accessibilityLabel).toBe('Streak: 5 days');
    expect(touch.props.testID).toBe('card');
  });

  it('shows a number of 0, and leaves the number out when there is none', () => {
    expect(render(<HomeWidgetCard label="x" icon="flash-outline" caption="c" value="0" />).getByText('0')).toBeTruthy();
    expect(render(<HomeWidgetCard label="x" icon="flash-outline" caption="c" value={0} />).getByText('0')).toBeTruthy();
    for (const value of [undefined, null]) {
      const utils = render(<HomeWidgetCard label="x" icon="flash-outline" caption="c" value={value} />);
      // Only the label and the caption: no empty big number takes up the room.
      expect(utils.UNSAFE_getAllByType(Text).map((n) => n.props.children)).toEqual(['x', 'c']);
    }
  });

  it('keeps a long label and caption to one line', () => {
    const utils = render(<HomeWidgetCard label="A very long widget name" icon="flash-outline" caption="A very long caption that would wrap" />);
    expect(utils.getByText('A very long widget name').props.numberOfLines).toBe(1);
    expect(utils.getByText('A very long caption that would wrap').props.numberOfLines).toBe(1);
  });
});
