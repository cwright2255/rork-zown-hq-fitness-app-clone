// The Try-On's 3D view (components/TryOnScene.jsx). Drawing needs a phone's graphics, so what is checked here is the layout the drawing depends on:
// on a real phone the view was blank because it had a height but no width inside the screen's centred stage, so it was 0 wide.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-gl', () => {
  const R = require('react');
  const { View: V } = require('react-native');
  return { GLView: (props) => R.createElement(V, { testID: 'gl', style: props.style }) };
});
jest.mock('expo-three', () => ({ Renderer: jest.fn() }));

import TryOnScene from '../components/TryOnScene';

describe('TryOnScene layout', () => {
  it('fills the width of its parent, so it is not 0 wide inside a centred stage', () => {
    const view = render(
      <View style={{ height: 340, justifyContent: 'center', alignItems: 'center' }}>
        <TryOnScene body={null} garment={null} height={340} />
      </View>,
    );
    const scene = view.toJSON().children[0];
    const style = StyleSheet.flatten(scene.props.style);
    expect(style.width).toBe('100%');
    expect(style.height).toBe(340);
  });

  it('gives the graphics view the whole area', () => {
    const view = render(<TryOnScene body={null} garment={null} />);
    const gl = view.getByTestId('gl');
    expect(StyleSheet.flatten(gl.props.style)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
  });
});
