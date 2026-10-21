import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import OverlayColumn from '../components/OverlayColumn';

const flat = (node) => StyleSheet.flatten(node.props.style);

describe('OverlayColumn', () => {
  it('stacks what it is given in order, as ordinary children', () => {
    const utils = render(
      <OverlayColumn edge="top" testID="col">
        <Text>first</Text>
        <Text>second</Text>
      </OverlayColumn>,
    );
    const column = utils.getByTestId('col');
    expect(column.children.map((c) => c.props.children)).toEqual(['first', 'second']);
  });

  it('is pinned to the top edge by default, with room between its children and the sides', () => {
    const utils = render(<OverlayColumn testID="col"><Text>a</Text></OverlayColumn>);
    const style = flat(utils.getByTestId('col'));
    expect(style).toMatchObject({ position: 'absolute', top: 16, left: 16, right: 16, gap: 8 });
    expect(style.bottom).toBeUndefined();
  });

  it('is pinned to the bottom edge when asked', () => {
    const utils = render(<OverlayColumn edge="bottom" testID="col"><Text>a</Text></OverlayColumn>);
    const style = flat(utils.getByTestId('col'));
    expect(style).toMatchObject({ position: 'absolute', bottom: 16, left: 16, right: 16 });
    expect(style.top).toBeUndefined();
  });

  it('lets touches through wherever there is no overlay', () => {
    const utils = render(<OverlayColumn testID="col"><Text>a</Text></OverlayColumn>);
    expect(utils.getByTestId('col').props.pointerEvents).toBe('box-none');
  });

  it('shows nothing extra when some of its children are not shown', () => {
    const utils = render(
      <OverlayColumn edge="bottom" testID="col">
        {false}
        <Text>caption</Text>
      </OverlayColumn>,
    );
    expect(utils.getByTestId('col').children).toHaveLength(1);
  });
});
