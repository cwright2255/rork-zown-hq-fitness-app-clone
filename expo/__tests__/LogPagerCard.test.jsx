// The card the Workout History and Running Log widgets share (components/LogPagerCard.jsx): pages you swipe between, dots, the latest
// entry and a View Full Log button.
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import LogPagerCard, { PAGE_WIDTH } from '../components/LogPagerCard';

const PAGES = [
  { key: 'week', title: 'Last 7 days', right: '2 runs', stats: [{ value: '15.0 km', label: 'Distance' }, { value: '1h 15m', label: 'Time' }, { value: '5:00 /km', label: 'Avg pace' }] },
  { key: 'month', title: 'This month', right: '', stats: [{ value: '20.0 km', label: 'Distance' }, { value: '1h 45m', label: 'Time' }, { value: '5:15 /km', label: 'Avg pace' }] },
  { key: 'all', title: 'All logged', right: '4 runs', stats: [{ value: '24.0 km', label: 'Distance' }, { value: '2h 5m', label: 'Time' }, { value: '5:13 /km', label: 'Avg pace' }] },
];
const LATEST = { title: 'Evening Run, 5.0 km', when: 'Yesterday', line: 'Evening Run, 5.0 km \u00B7 Yesterday' };

const card = (props = {}) => (
  <LogPagerCard
    testID="card"
    icon="stats-chart-outline"
    label="Running Log"
    pages={PAGES}
    latest={LATEST}
    empty={false}
    emptyText="No runs yet."
    accessibilityLabel="Running log. All the pages in words"
    onOpen={() => {}}
    {...props}
  />
);
const swipeTo = (utils, x) => fireEvent(utils.getByTestId('card-pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x } } });
const dotWidths = (utils) => [0, 1, 2].map((i) => StyleSheet.flatten(utils.getByTestId(`card-dot-${i}`).props.style).width);
const dotColors = (utils) => [0, 1, 2].map((i) => StyleSheet.flatten(utils.getByTestId(`card-dot-${i}`).props.style).backgroundColor);
const iconNames = (utils) => utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name);

describe('LogPagerCard', () => {
  it('draws the title, the icon, every page with its three numbers, and the latest entry', () => {
    const utils = render(card());
    expect(utils.getByText('Running Log')).toBeTruthy();
    expect(iconNames(utils)).toEqual(['stats-chart-outline']);
    PAGES.forEach((page) => {
      expect(utils.getByTestId(`card-page-${page.key}`)).toBeTruthy();
      expect(utils.getByText(page.title)).toBeTruthy();
      page.stats.forEach((stat) => expect(utils.getByText(stat.value)).toBeTruthy());
    });
    expect(utils.getAllByText('Distance')).toHaveLength(3);
    expect(utils.getAllByText('Avg pace')).toHaveLength(3);
    expect(utils.getByText('Last 7 days')).toBeTruthy();
    expect(utils.getByTestId('card-latest').props.children).toBe('Latest: Evening Run, 5.0 km \u00B7 Yesterday');
  });

  it('shows the count on the right of a page that has one, and nothing on one that does not', () => {
    const utils = render(card());
    expect(utils.getByText('2 runs')).toBeTruthy();
    expect(utils.getByText('4 runs')).toBeTruthy();
    const month = utils.getByTestId('card-page-month');
    expect(month.findAll((n) => n.type === 'Text').map((n) => n.props.children)).toEqual(
      ['This month', '20.0 km', 'Distance', '1h 45m', 'Time', '5:15 /km', 'Avg pace'],
    );
  });

  it('is a horizontal pager that snaps to a page, as wide as the card has room for', () => {
    const utils = render(card());
    const pager = utils.getByTestId('card-pager');
    expect(pager.props.horizontal).toBe(true);
    expect(pager.props.pagingEnabled).toBe(true);
    expect(pager.props.showsHorizontalScrollIndicator).toBe(false);
    expect(StyleSheet.flatten(pager.props.style).width).toBe(PAGE_WIDTH);
    expect(StyleSheet.flatten(utils.getByTestId('card-page-week').props.style).width).toBe(PAGE_WIDTH);
    // The screen less Home's 22 on each side and the card's 16 on each side: the width the Steps card's pages already use.
    expect(PAGE_WIDTH).toBe(Dimensions.get('window').width - 76);
  });

  describe('the dots', () => {
    it('start on the first page, with one dot per page', () => {
      const utils = render(card());
      expect(dotWidths(utils)).toEqual([16, 6, 6]);
      expect(dotColors(utils)).toEqual(['#000', '#E0E0E0', '#E0E0E0']);
    });

    it('follow the swipe, to the middle page and the last one, and back', () => {
      const utils = render(card());
      swipeTo(utils, PAGE_WIDTH);
      expect(dotWidths(utils)).toEqual([6, 16, 6]);
      swipeTo(utils, PAGE_WIDTH * 2);
      expect(dotWidths(utils)).toEqual([6, 6, 16]);
      swipeTo(utils, 0);
      expect(dotWidths(utils)).toEqual([16, 6, 6]);
    });

    it('settle on the nearest page when a swipe stops part of the way', () => {
      const utils = render(card());
      swipeTo(utils, PAGE_WIDTH * 0.4);
      expect(dotWidths(utils)).toEqual([16, 6, 6]);
      swipeTo(utils, PAGE_WIDTH * 0.6);
      expect(dotWidths(utils)).toEqual([6, 16, 6]);
      swipeTo(utils, PAGE_WIDTH * 1.4);
      expect(dotWidths(utils)).toEqual([6, 16, 6]);
    });

    it('stay on a real page when the pager bounces past either end', () => {
      const utils = render(card());
      swipeTo(utils, -PAGE_WIDTH);
      expect(dotWidths(utils)).toEqual([16, 6, 6]);
      swipeTo(utils, PAGE_WIDTH * 5);
      expect(dotWidths(utils)).toEqual([6, 6, 16]);
    });
  });

  it('opens the full log from the button, and from nothing else', () => {
    const onOpen = jest.fn();
    const utils = render(card({ onOpen }));
    expect(utils.getByText('View Full Log')).toBeTruthy();
    const button = utils.getByTestId('card-open');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('View the full log: Running Log');
    fireEvent.press(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.press(utils.getByText('Last 7 days'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('reads the whole card to a screen reader as one sentence, since the pages beyond the first cannot be swiped to by voice', () => {
    const utils = render(card());
    const group = utils.UNSAFE_root.findAll((n) => n.type === 'View' && n.props.accessibilityLabel === 'Running log. All the pages in words');
    expect(group).toHaveLength(1);
    expect(group[0].props.accessible).toBe(true);
    expect(group[0].findAll((n) => n.props?.testID === 'card-pager').length).toBeGreaterThan(0);
  });

  it('leaves out the latest line when there is no latest entry', () => {
    const utils = render(card({ latest: null }));
    expect(utils.queryByTestId('card-latest')).toBeNull();
    expect(utils.queryByText(/Latest/)).toBeNull();
    expect(utils.getByTestId('card-pager')).toBeTruthy();
  });

  describe('when there is nothing yet', () => {
    it('says so in place of the pages and the dots, and keeps the button', () => {
      const onOpen = jest.fn();
      const utils = render(card({ empty: true, latest: null, onOpen }));
      expect(utils.getByTestId('card-empty').props.children).toBe('No runs yet.');
      expect(utils.queryByTestId('card-pager')).toBeNull();
      expect(utils.queryByTestId('card-dot-0')).toBeNull();
      expect(utils.queryByTestId('card-latest')).toBeNull();
      expect(utils.queryByText('Last 7 days')).toBeNull();
      fireEvent.press(utils.getByTestId('card-open'));
      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('does not say it when there is something', () => {
      const utils = render(card());
      expect(utils.queryByTestId('card-empty')).toBeNull();
      expect(utils.queryByText('No runs yet.')).toBeNull();
    });
  });
});
