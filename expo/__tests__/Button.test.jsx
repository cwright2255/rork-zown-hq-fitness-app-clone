import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../src/components/ui/Button';

describe('Button', () => {
  it('renders with label', () => {
    const { getByText } = render(<Button label="Go" onPress={() => undefined} />);
    expect(getByText('Go')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator and hides label', () => {
    const { queryByText } = render(
      <Button label="Save" onPress={() => undefined} loading />,
    );
    expect(queryByText('Save')).toBeNull();
  });

  it('is disabled while loading', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button label="Send" onPress={onPress} loading />,
    );
    const btn = getByRole('button');
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
    expect(btn.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});
