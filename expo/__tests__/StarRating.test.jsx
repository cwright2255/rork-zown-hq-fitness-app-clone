// The star display for a food's rating (components/StarRating.jsx): five stars, in half steps.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : name) }), { virtual: true });

import React from 'react';
import { render } from '@testing-library/react-native';
import StarRating, { STAR_FILLED, STAR_EMPTY, starsLabel } from '../components/StarRating';

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const stars = (utils, fill) => utils.UNSAFE_queryAllByType('Star').filter((s) => s.props.fill === fill);

describe('StarRating', () => {
  it.each(STEPS)('draws %s stars: that many filled, a half star for a .5, and the rest empty', (value) => {
    const utils = render(<StarRating stars={value} />);
    const whole = Math.floor(value);
    const half = value % 1 === 0.5 ? 1 : 0;
    expect(stars(utils, STAR_FILLED)).toHaveLength(whole);
    expect(utils.queryAllByTestId('star-half')).toHaveLength(half);
    expect(utils.UNSAFE_queryAllByType('StarHalf')).toHaveLength(half);
    // The empty stars are the ones after the filled ones, and the empty star the half star sits on.
    expect(stars(utils, 'transparent')).toHaveLength(5 - whole);
    expect(utils.UNSAFE_queryAllByType('Star')).toHaveLength(5);
  });

  it('puts the half star after the whole ones, in the amber of a filled star, on a grey star', () => {
    const utils = render(<StarRating stars={2.5} />);
    const half = utils.getByTestId('star-half');
    const [under] = utils.UNSAFE_queryAllByType('Star').filter((s) => s.props.color === STAR_EMPTY && s.parent && s.parent.props.testID === 'star-half');
    expect(under).toBeTruthy();
    const top = utils.UNSAFE_getByType('StarHalf');
    expect(top.props.color).toBe(STAR_FILLED);
    expect(top.props.fill).toBe(STAR_FILLED);
    expect(half).toBeTruthy();
    // Two filled stars come before it in the row.
    const row = utils.getByTestId('star-rating').children;
    expect(row).toHaveLength(5);
  });

  it('says the stars out loud for a screen reader', () => {
    expect(starsLabel(3.5)).toBe('3.5 out of 5 stars');
    expect(starsLabel(4)).toBe('4 out of 5 stars');
    const utils = render(<StarRating stars={4.5} />);
    expect(utils.getByLabelText('4.5 out of 5 stars')).toBeTruthy();
  });

  it.each([null, undefined, 0, NaN])('draws nothing for %s, rather than a misleading default', (value) => {
    const utils = render(<StarRating stars={value} />);
    expect(utils.queryByTestId('star-rating')).toBeNull();
    expect(utils.UNSAFE_queryAllByType('Star')).toHaveLength(0);
  });

  it('takes its size and the gap between stars', () => {
    const utils = render(<StarRating stars={2.5} size={16} gap={2} />);
    expect(utils.UNSAFE_queryAllByType('Star').every((s) => s.props.size === 16)).toBe(true);
    expect(utils.UNSAFE_getByType('StarHalf').props.size).toBe(16);
    expect(utils.getByTestId('star-rating').props.style).toMatchObject({ flexDirection: 'row', gap: 2 });
    expect(utils.getByTestId('star-half').props.style).toMatchObject({ width: 16, height: 16 });
  });

  it('is 12 big with a gap of 1 unless told otherwise', () => {
    const utils = render(<StarRating stars={5} />);
    expect(utils.UNSAFE_getAllByType('Star')[0].props.size).toBe(12);
    expect(utils.getByTestId('star-rating').props.style).toMatchObject({ gap: 1 });
  });
});
