// The three Shop screens (app/shop.jsx, app/shop/product/[id].jsx, app/shop/try-on.jsx) while the Shop is not open. They used to be a
// mock-up that looked finished: a cart badge that always said 2, search, cart, heart, Join, View All and Clear buttons that did nothing,
// cards that did nothing when tapped, a product page that was always the same tee with three reviews from people who do not exist and
// "4.5 (128 reviews)", an Add to Cart with no action, and a Try-On that said "Your look has been saved." without saving anything.
// These look at what is on the screens and at what can be pressed. The Try-On is now a real 3D try-on with its own tests (TryOnScreen.test.jsx); here it is
// held to the same rules as the other two: nothing invented, nothing that looks pressable and does nothing.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Alert, Pressable } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
}), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
// Icons as text, so they can be looked for by name (and the real ones do not load their font in the middle of a test).
jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { Ionicons: ({ name }) => mockReact.createElement(mockRn.Text, null, `icon:${name}`) };
}, { virtual: true });
// The Try-On draws in 3D and reads the person's body; none of that runs here (TryOnScreen.test.jsx covers it). With no body scan it asks for one.
jest.mock('@/components/TryOnScene', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/tryOn/latestScan', () => ({ latestScan: async () => null }));
jest.mock('@/lib/loadScanMesh', () => ({ loadScanMesh: jest.fn() }));
jest.mock('@/lib/tryOn/appPackStore', () => ({ getAppPackStore: () => ({}) }));

import { router as mockRouter } from 'expo-router';
import ShopScreen from '../app/shop';
import ProductScreen from '../app/shop/product/[id]';
import TryOnScreen from '../app/shop/try-on';

const ROOT = path.join(__dirname, '..');
const FILES = ['app/shop.jsx', 'app/shop/product/[id].jsx', 'app/shop/try-on.jsx'];
const source = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// Every piece of text on the screen, in order, and the names of the icons drawn.
const texts = (view) => view.UNSAFE_root.findAll((n) => n.type === 'Text').map((n) => [].concat(n.props.children).join('')).filter((t) => !t.startsWith('icon:'));
const iconNames = (view) => view.UNSAFE_root.findAll((n) => typeof n.type === 'string' && n.type === 'Text' && [].concat(n.props.children).join('').startsWith('icon:')).map((n) => [].concat(n.props.children).join('').slice(5));
// Pressable is a memo around the real component, which is the type that shows up in the tree.
const pressables = (view) => view.UNSAFE_root.findAll((n) => n.type === Pressable.type);
const labelOf = (node) => node.findAll((n) => n.type === 'Text').map((t) => [].concat(t.props.children).join('')).filter((t) => !t.startsWith('icon:')).join(' ');
const pressableWith = (view, label) => pressables(view).find((p) => labelOf(p).includes(label));

// Lets the Try-On's look for a body scan finish, so what it does next happens inside the test and not after it.
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the Shop tab', () => {
  it('says the Shop is coming soon, in the header and in a note that says nothing can be bought', () => {
    const view = render(<ShopScreen />);
    const all = texts(view);
    expect(all.filter((t) => t === 'Coming soon').length).toBeGreaterThanOrEqual(2);
    expect(all.some((t) => /Shop is coming soon/.test(t) && /Nothing here can be bought yet/.test(t))).toBe(true);
    expect(all).toContain('Shop');
  });

  it('has no cart badge: no number on its own anywhere, and no cart or search icon', () => {
    const view = render(<ShopScreen />);
    expect(texts(view).filter((t) => /^\d+$/.test(t.trim()))).toEqual([]);
    expect(iconNames(view)).not.toEqual(expect.arrayContaining(['cart-outline']));
    for (const icon of ['cart-outline', 'cart', 'search-outline', 'heart-outline']) expect(iconNames(view)).not.toContain(icon);
  });

  it('has nothing to press: not one button, so no card, label or banner invites a tap that does nothing', () => {
    const view = render(<ShopScreen />);
    expect(pressables(view)).toHaveLength(0);
    expect(view.UNSAFE_root.findAll((n) => typeof n.props.onPress === 'function')).toHaveLength(0);
    expect(view.UNSAFE_root.findAll((n) => typeof n.props.onPressIn === 'function' || typeof n.props.onLongPress === 'function')).toHaveLength(0);
  });

  it('has no View All, Clear, Join or Try Now', () => {
    const all = texts(render(<ShopScreen />));
    for (const word of ['View All', 'Clear', 'Join', 'Try Now']) expect(all).not.toContain(word);
  });

  it('tapping a card goes nowhere', () => {
    const view = render(<ShopScreen />);
    fireEvent.press(view.getByText('Performance Tee'));
    fireEvent.press(view.getByText('Gym Ready'));
    fireEvent.press(view.getByText('Apparel'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('does not promise rewards as if they were open', () => {
    const all = texts(render(<ShopScreen />));
    expect(all).toContain('Coming soon: earn XP on purchases and unlock exclusive gear');
    expect(all.join('|')).not.toMatch(/\\u2022/);
  });

  it('keeps the sample items it shows, as a preview', () => {
    const all = texts(render(<ShopScreen />));
    for (const word of ['New Arrivals', 'Shop by Look', 'Trending Now', 'Recently Viewed', 'Performance Tee', 'Gym Ready']) expect(all).toContain(word);
  });
});

describe('the way buttons are counted', () => {
  it('finds the buttons on a screen that has them, so "none" above means none', async () => {
    expect(pressables(render(<ProductScreen />))).toHaveLength(12);
    expect(pressables(render(<ShopScreen />))).toHaveLength(0); // and a screen with nothing to press is counted as none
    const tryOn = render(<TryOnScreen />);
    await settle();
    expect(pressables(tryOn).length).toBeGreaterThanOrEqual(1);
  });

  it('finds icons by name, so "no cart icon" above means none', () => {
    expect(iconNames(render(<ProductScreen />))).toContain('chevron-back');
    expect(iconNames(render(<ShopScreen />))).toContain('shirt-outline');
  });
});

describe('the product page', () => {
  const REVIEWERS = ['Alex R.', 'Sarah M.', 'Mike T.'];

  it('has no reviews, no reviewers and no rating', () => {
    const view = render(<ProductScreen />);
    const all = texts(view).join('|');
    for (const name of REVIEWERS) expect(all).not.toContain(name);
    expect(all).not.toMatch(/4\.5/);
    expect(all).not.toMatch(/\d+ reviews?/i);
    expect(all).not.toMatch(/Reviews/);
    expect(all).not.toMatch(/Amazing quality|Love the design|Best workout gear/);
    for (const icon of ['star', 'star-half', 'star-outline', 'person']) expect(iconNames(view)).not.toContain(icon);
  });

  it('says the item is a sample and the Shop is not open', () => {
    expect(texts(render(<ProductScreen />))).toContain('Coming soon. This is a sample item: the Shop is not open yet.');
  });

  it('has an Add to Cart that is disabled, and pressing it does nothing', () => {
    const view = render(<ProductScreen />);
    const add = pressableWith(view, 'Add to Cart');
    expect(add).toBeTruthy();
    expect(add.props.disabled).toBe(true);
    expect(add.props.accessibilityState).toEqual({ disabled: true });
    expect(add.props.onPress).toBeUndefined(); // disabled, and nothing behind it to switch on by mistake
    fireEvent.press(view.getByText('Add to Cart'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('has no share button: the buttons are Back, the five sizes, the four colours and Digital Try-On, and Add to Cart disabled', () => {
    const view = render(<ProductScreen />);
    const enabled = pressables(view).filter((p) => !p.props.disabled);
    expect(enabled).toHaveLength(1 + 5 + 4 + 1);
    expect(iconNames(view)).not.toContain('share-outline');
  });

  it('keeps Back and Digital Try-On working', () => {
    const view = render(<ProductScreen />);
    fireEvent.press(view.getByText('Digital Try-On'));
    expect(mockRouter.push).toHaveBeenCalledWith('/shop/try-on');
    fireEvent.press(pressables(view)[0]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('still lets a size be picked', () => {
    const view = render(<ProductScreen />);
    const before = pressableWith(view, 'XL').props.style;
    fireEvent.press(view.getByText('XL'));
    expect(pressableWith(view, 'XL').props.style).not.toEqual(before);
  });
});

describe('Digital Try-On', () => {
  it('shows no Save Look or Share, and no longer says Coming soon', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    const all = texts(view);
    for (const word of ['Save Look', 'Share', 'Coming soon', 'AR Preview', 'Take Photo']) expect(all).not.toContain(word);
    expect(iconNames(view)).not.toContain('bookmark-outline');
    expect(iconNames(view)).not.toContain('share-outline');
  });

  it('never tells anyone a look was saved', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(source('app/shop/try-on.jsx')).not.toMatch(/Your look has been saved|Saved!|Sharing coming soon/);
  });

  it('asks for a body scan when there is none, and the button opens the scan screen', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(texts(view)).toContain('Take a body scan first. Try-On fits garments to your 3D body.');
    fireEvent.press(view.getByText('Take a Body Scan'));
    expect(mockRouter.push).toHaveBeenCalledWith('/body-scan/capture');
  });

  it('has only buttons that do something: Back and Take a Body Scan', async () => {
    const view = render(<TryOnScreen />);
    await settle();
    expect(pressables(view)).toHaveLength(2);
    fireEvent.press(pressables(view)[0]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('the Shop screens\' source', () => {
  it.each(FILES)('%s has no invented reviewer, rating, review count or cart count', (file) => {
    const code = source(file);
    for (const made of ['Alex R.', 'Sarah M.', 'Mike T.', '4.5 (128', '128 reviews', 'REVIEWS', 'cartCount', 'cartBadge']) expect(code).not.toContain(made);
  });

  it.each(FILES)('%s has no handler that is left empty or marked TODO', (file) => {
    const code = source(file);
    expect(code).not.toMatch(/onPress=\{\s*\(\)\s*=>\s*(\{\s*(\/\*[^*]*\*\/)?\s*\}|\{\}\s*)\}/);
    expect(code).not.toMatch(/onPress=\{\(\) => \{ \/\* TODO/);
    expect(code).not.toMatch(/onAction/);
  });
});
