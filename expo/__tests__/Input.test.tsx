import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../src/components/ui/Input';

describe('Input', () => {
  it('renders label and placeholder', () => {
    const { getByText, getByPlaceholderText } = render(
      <Input label="Email" placeholder="you@example.com" />,
    );
    expect(getByText('Email')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('shows error text', () => {
    const { getByText } = render(<Input label="Email" error="Required" />);
    expect(getByText('Required')).toBeTruthy();
  });

  it('toggles secureTextEntry visibility', () => {
    const { getByText, getByPlaceholderText } = render(
      <Input label="Password" placeholder="pw" secureTextEntry />,
    );
    const field = getByPlaceholderText('pw');
    expect(field.props.secureTextEntry).toBe(true);
    fireEvent.press(getByText('Show'));
    expect(field.props.secureTextEntry).toBe(false);
  });
});
