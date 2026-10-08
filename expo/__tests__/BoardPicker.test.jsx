import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import BoardPicker from '../components/BoardPicker';

const selected = (utils, id) => utils.getByTestId(id).props.accessibilityState.selected;

describe('BoardPicker', () => {
  it('starts on XP, with no period choice', () => {
    const utils = render(<BoardPicker board="xp" onChange={jest.fn()} />);
    expect(selected(utils, 'board-xp')).toBe(true);
    expect(selected(utils, 'board-distance')).toBe(false);
    expect(utils.queryByTestId('board-week')).toBeNull();
    expect(utils.queryByTestId('board-month')).toBeNull();
  });

  it('goes to this week when Distance is chosen', () => {
    const onChange = jest.fn();
    const utils = render(<BoardPicker board="xp" onChange={onChange} />);
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('shows this week and this month once on a distance board', () => {
    const utils = render(<BoardPicker board="week" onChange={jest.fn()} />);
    expect(selected(utils, 'board-distance')).toBe(true);
    expect(selected(utils, 'board-xp')).toBe(false);
    expect(selected(utils, 'board-week')).toBe(true);
    expect(selected(utils, 'board-month')).toBe(false);
    expect(utils.getByText('This week')).toBeTruthy();
    expect(utils.getByText('This month')).toBeTruthy();
  });

  it('switches between the two periods', () => {
    const onChange = jest.fn();
    const utils = render(<BoardPicker board="week" onChange={onChange} />);
    fireEvent.press(utils.getByTestId('board-month'));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('keeps the chosen period when Distance is pressed again', () => {
    const onChange = jest.fn();
    const utils = render(<BoardPicker board="month" onChange={onChange} />);
    expect(selected(utils, 'board-month')).toBe(true);
    fireEvent.press(utils.getByTestId('board-distance'));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('goes back to XP', () => {
    const onChange = jest.fn();
    const utils = render(<BoardPicker board="month" onChange={onChange} />);
    fireEvent.press(utils.getByTestId('board-xp'));
    expect(onChange).toHaveBeenCalledWith('xp');
  });

  it('opens on XP when given nothing', () => {
    const utils = render(<BoardPicker onChange={jest.fn()} />);
    expect(selected(utils, 'board-xp')).toBe(true);
  });
});
