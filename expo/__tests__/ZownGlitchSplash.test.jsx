// The launch splash (components/ZownGlitchSplash.jsx): the black ZOWN wordmark glitches in on white, holds clean, then the white
// slides up. What it draws at each frame is lib/zownGlitchSpec.js; these tests run it on a fake clock.
import React from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import ZownGlitchSplash, { FAILSAFE_MS, GLITCH_MS, LOGO_WIDTH_RATIO, SLIDE_MS } from '../components/ZownGlitchSplash';
import { frameSpec, SPEC } from '../lib/zownGlitchSpec';

const FRAME_STEP = 16; // the fake clock's animation frames

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const advance = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const images = (utils) => utils.UNSAFE_queryAllByType(Image);
const tintOf = (image) => StyleSheet.flatten(image.props.style).tintColor;
const boxColours = (utils) => utils.UNSAFE_queryAllByType(View)
  .map((v) => StyleSheet.flatten(v.props.style) || {})
  .map((s) => s.backgroundColor)
  .filter((c) => c && c !== '#FFFFFF');

describe('the splash screen', () => {
  it('covers the whole screen in white, with the wordmark in the middle at 70% of the width', () => {
    const { width, height } = Dimensions.get('window');
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    const overlay = StyleSheet.flatten(utils.getByTestId('launch-splash').props.style);
    expect(overlay.position).toBe('absolute');
    expect([overlay.top, overlay.left, overlay.right, overlay.bottom]).toEqual([0, 0, 0, 0]);
    expect(overlay.backgroundColor).toBe('#FFFFFF');
    expect(LOGO_WIDTH_RATIO).toBe(0.7);

    const logo = StyleSheet.flatten(utils.getByTestId('launch-splash-logo').props.style);
    const logoW = Math.round(width * 0.7);
    const logoH = Math.round(SPEC.LOGO_H * (logoW / SPEC.LOGO_W));
    expect(logo.width).toBe(logoW);
    expect(logo.height).toBe(logoH);
    expect(logo.left).toBe(Math.round((width - logoW) / 2));
    expect(logo.top).toBe(Math.round((height - logoH) / 2));
  });

  it('is labelled ZOWN for VoiceOver', () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    expect(utils.getByLabelText('ZOWN')).toBeTruthy();
  });

  it('takes the touches while it is up, so nothing under it can be tapped by accident', () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    const overlay = utils.getByTestId('launch-splash');
    expect(overlay.props.pointerEvents).not.toBe('none');
    expect(StyleSheet.flatten(overlay.props.style).pointerEvents).not.toBe('none'); // it can also be set in the style
  });

  it('starts with none of the logo there, only coloured blocks', () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    expect(images(utils)).toHaveLength(0);
    expect(boxColours(utils).length).toBe(frameSpec(0).blocks.length + frameSpec(0).lines.length);
    expect(boxColours(utils).length).toBeGreaterThan(0);
  });

  it('tears the logo in: slices in cyan and orange fringes, with the logo\'s own black on top', async () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    await advance(700);
    const tints = images(utils).map(tintOf);
    expect(tints).toContain(SPEC.CYAN);
    expect(tints).toContain(SPEC.ORANGE);
    expect(tints).toContain(undefined);
    expect(tints.every((t) => t === undefined || [SPEC.CYAN, SPEC.ORANGE, SPEC.GREY].includes(t))).toBe(true);
    // the black slices are drawn last, so they sit on top of the fringes
    const order = images(utils).map(tintOf);
    expect(order.lastIndexOf(SPEC.CYAN)).toBeLessThan(order.indexOf(undefined));
    expect(order.lastIndexOf(SPEC.ORANGE)).toBeLessThan(order.indexOf(undefined));
  });

  it('draws at each moment what the spec says for that frame (blocks and streaks, fringes)', async () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    let steps = 0;
    for (const target of [3, 20, 42, 60, 90]) {
      await advance((target - steps) * FRAME_STEP);
      steps = target;
      const spec = frameSpec(Math.floor((target * FRAME_STEP * SPEC.FPS) / 1000));
      expect(boxColours(utils).length).toBe(spec.blocks.length + spec.lines.length);
      const tints = images(utils).map(tintOf);
      expect(tints.filter((t) => t === SPEC.CYAN).length).toBe(spec.fringe ? spec.bands.filter((b) => b.visible).length : 0);
      expect(tints.filter((t) => t === SPEC.ORANGE).length).toBe(spec.fringe ? spec.bands.filter((b) => b.visible).length : 0);
    }
  });

  it('only ever uses the approved colours, and shows the green and the dark red somewhere in the burst', async () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    const seen = new Set();
    for (let t = 0; t < GLITCH_MS; t += FRAME_STEP) {
      await advance(FRAME_STEP);
      boxColours(utils).forEach((c) => seen.add(c));
    }
    const allowed = [SPEC.CYAN, SPEC.ORANGE, SPEC.DARK_RED, SPEC.INK, SPEC.GREEN];
    expect([...seen].every((c) => allowed.includes(c))).toBe(true);
    expect(seen.has(SPEC.GREEN)).toBe(true);
    expect(seen.has(SPEC.DARK_RED)).toBe(true);
    expect(seen.has(SPEC.CYAN)).toBe(true);
    expect(seen.has(SPEC.ORANGE)).toBe(true);
  });

  it('holds as one plain, untinted wordmark when the glitch is over', async () => {
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    await advance(GLITCH_MS - 100);
    const found = images(utils);
    expect(found).toHaveLength(1);
    expect(tintOf(found[0])).toBeUndefined();
    expect(boxColours(utils)).toEqual([]);
  });

  // React Native's test setup finishes a native-driver animation at once, so the slide is a stand-in whose end the test controls.
  const controlledSlide = () => {
    const slide = { done: null, stop: jest.fn() };
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (cb) => { slide.done = cb; },
      stop: slide.stop,
    }));
    return slide;
  };

  it('is the plain, clean wordmark while it slides away: no fringes, blocks or streaks travel with it', async () => {
    const slide = controlledSlide();
    const utils = render(<ZownGlitchSplash onFinish={() => {}} />);
    await advance(GLITCH_MS - 20);
    expect(slide.done).toBeNull(); // the last glitch frame is still showing
    await advance(40);
    expect(slide.done).toEqual(expect.any(Function)); // the slide has started
    const found = images(utils);
    expect(found).toHaveLength(1);
    expect(tintOf(found[0])).toBeUndefined();
    expect(boxColours(utils)).toEqual([]);
    expect(frameSpec(SPEC.TOTAL_FRAMES - 1).clean).toBe(true);
  });

  it('does not finish during the glitch or while sliding, and finishes once, when the slide is done', async () => {
    const slide = controlledSlide();
    const onFinish = jest.fn();
    render(<ZownGlitchSplash onFinish={onFinish} />);
    await advance(GLITCH_MS - 50);
    expect(slide.done).toBeNull(); // the slide has not started
    expect(onFinish).not.toHaveBeenCalled();
    await advance(100);
    expect(slide.done).toEqual(expect.any(Function)); // now it has
    expect(onFinish).not.toHaveBeenCalled(); // and it is still going
    act(() => slide.done({ finished: true }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    await advance(10000);
    expect(onFinish).toHaveBeenCalledTimes(1); // the safety timer does not call it a second time
  });

  it('slides the whole screen up by its height, over 800 ms, the way the login screen always did', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { height } = Dimensions.get('window');
    render(<ZownGlitchSplash onFinish={() => {}} />);
    await advance(GLITCH_MS - 50);
    expect(timing).not.toHaveBeenCalled();
    await advance(100);
    expect(timing).toHaveBeenCalledTimes(1);
    const [, config] = timing.mock.calls[0];
    expect(config.toValue).toBe(-height);
    expect(config.duration).toBe(800);
    expect(config.useNativeDriver).toBe(true);
    expect(SLIDE_MS).toBe(800);
  });

  it('is gone (never calls onFinish) if the screen is closed part of the way through', async () => {
    const onFinish = jest.fn();
    const utils = render(<ZownGlitchSplash onFinish={onFinish} />);
    await advance(1000);
    utils.unmount();
    await advance(20000);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('is gone (never calls onFinish) if the screen is closed during the slide, and stops the slide', async () => {
    const slide = controlledSlide();
    const onFinish = jest.fn();
    const utils = render(<ZownGlitchSplash onFinish={onFinish} />);
    await advance(GLITCH_MS + 100);
    expect(slide.done).toEqual(expect.any(Function));
    utils.unmount();
    expect(slide.stop).toHaveBeenCalledTimes(1);
    act(() => slide.done({ finished: false })); // what React Native does when an animation is stopped
    await advance(20000);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('ends by itself, once, even if the slide never reports back', async () => {
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn() }));
    const onFinish = jest.fn();
    render(<ZownGlitchSplash onFinish={onFinish} />);
    await advance(FAILSAFE_MS - 100);
    expect(onFinish).not.toHaveBeenCalled();
    await advance(200);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(FAILSAFE_MS).toBeGreaterThan(GLITCH_MS + SLIDE_MS);
  });

  it('calls the latest onFinish it was given, not the first', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const utils = render(<ZownGlitchSplash onFinish={first} />);
    utils.rerender(<ZownGlitchSplash onFinish={second} />);
    await advance(GLITCH_MS + SLIDE_MS + 300);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('plays for four seconds in all: 3.2 of glitch and 0.8 of slide', () => {
    expect(GLITCH_MS).toBe(3200);
    expect(GLITCH_MS + SLIDE_MS).toBe(4000);
  });
});
