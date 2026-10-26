// The Today brief on the Home screen (components/TodayBriefCard.jsx): open to every plan, and always on the screen for a signed-in person:
// today's brief, a skeleton while it is first written, the last brief kept (marked with its day, with a button to try again) when today's
// cannot be written, and a card that says it is not ready when there is nothing kept either. It never goes away because the AI had nothing.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@/store/userStore', () => ({ useUserStore: (select) => select({ user: global.__user }) }));
jest.mock('@/services/briefService', () => ({ getTodayBrief: jest.fn(), getLastBrief: jest.fn(), peekTodayBrief: jest.fn() }));

import TodayBriefCard, { BRIEF_FOOTNOTE, BRIEF_NOT_READY_TEXT, BRIEF_EARLIER_NOTE, briefDayLabel } from '../components/TodayBriefCard';
import { getTodayBrief, getLastBrief, peekTodayBrief } from '@/services/briefService';
import { useEntitlementStore } from '../store/entitlementStore';

const BRIEF = { headline: 'A good day to train', points: ['Sleep was 8 hours.', 'Keep the lifting moderate.', 'Walk after dinner.'] };
const OLDER = { headline: 'Take it easy', points: ['Recovery was low.', 'Stretch tonight.'] };
const EARLIER = { brief: OLDER, day: '2026-10-25' };
const plan = (over = {}) => ({ tier: 'pro', status: 'active', expiresAt: null, source: 'manual', ...over });
const setStore = (state) => act(() => { useEntitlementStore.setState({ plan: null, isLoaded: false, ...state }); });
const textOf = (utils) => utils.UNSAFE_getAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
const show = async (props = {}) => {
  const utils = render(<TodayBriefCard {...props} />);
  await settle();
  return utils;
};
const later = () => {
  const box = {};
  box.promise = new Promise((resolve) => { box.finish = resolve; });
  return box;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.__user = { uid: 'u1', name: 'Sam' };
  getTodayBrief.mockResolvedValue(BRIEF);
  getLastBrief.mockResolvedValue(null);
  peekTodayBrief.mockReturnValue(null);
  setStore({ plan: plan(), isLoaded: true });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe("today's brief", () => {
  it('shows the headline and the points, in the order they were written, and what the note is', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
    expect(BRIEF.points.map((_, i) => utils.getByTestId(`today-brief-point-${i}`).props.children)).toEqual(BRIEF.points);
    expect(utils.queryByTestId('today-brief-point-3')).toBeNull();
    expect(utils.getByTestId('today-brief-note').props.children).toBe(BRIEF_FOOTNOTE);
    expect(BRIEF_FOOTNOTE).toMatch(/not medical advice/);
    expect(textOf(utils)).toContain('Today brief');
  });

  it('has the brief read out as a heading followed by the points', async () => {
    const utils = await show();
    expect(utils.getByTestId('today-brief-headline').props.accessibilityRole).toBe('header');
  });

  it('is asked for once, for this person, from the service, and the last brief is not looked for', async () => {
    await show();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).toHaveBeenCalledWith({ user: global.__user });
    expect(getLastBrief).not.toHaveBeenCalled();
  });

  it('can be given other sources of briefs', async () => {
    const getBrief = jest.fn(async () => ({ headline: 'Rest up', points: ['Easy day.'] }));
    const getEarlier = jest.fn(async () => null);
    const peek = jest.fn(() => null);
    const utils = await show({ getBrief, getEarlier, peek });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Rest up');
    expect(getBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).not.toHaveBeenCalled();
    expect(peekTodayBrief).not.toHaveBeenCalled();
  });

  it('is not marked as an earlier brief, has no try again button and has no lock', async () => {
    const utils = await show();
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(utils.queryByTestId('today-brief-day')).toBeNull();
    expect(utils.queryByTestId('today-brief-earlier-note')).toBeNull();
    expect(utils.queryByTestId('today-brief-try-again')).toBeNull();
    expect(utils.queryByTestId('today-brief-missing')).toBeNull();
    expect(utils.queryByTestId('today-brief-locked')).toBeNull();
    expect(utils.queryByTestId('today-brief-see-plans')).toBeNull();
    expect(utils.queryByTestId('today-brief-plan')).toBeNull();
  });

  it('shows a skeleton while the brief is first being written, then the brief', async () => {
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    const utils = await show();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    expect(utils.getByLabelText('Writing your Today brief')).toBeTruthy();
    expect(textOf(utils)).toContain('Writing your brief');
    expect(utils.queryByTestId('today-brief')).toBeNull();
    await act(async () => { written.finish(BRIEF); });
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });

  it('shows the skeleton, not an earlier brief, until the first write of the day has failed', async () => {
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(getLastBrief).not.toHaveBeenCalled();
    await act(async () => { written.finish(null); });
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
  });

  it('has a long brief shown whole', async () => {
    const long = 'x'.repeat(240);
    getTodayBrief.mockResolvedValue({ headline: 'y'.repeat(120), points: [long] });
    const utils = await show();
    expect(utils.getByTestId('today-brief-point-0').props.children).toBe(long);
  });

  it('does not ask again when the screen renders again, or when their profile changes', async () => {
    const utils = await show();
    utils.rerender(<TodayBriefCard />);
    global.__user = { ...global.__user, name: 'Samuel' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });
});

describe('on every plan', () => {
  const plans = {
    'Free (no plan)': { isLoaded: true },
    Pro: { plan: plan(), isLoaded: true },
    Legend: { plan: plan({ tier: 'legend' }), isLoaded: true },
    'a plan that has ended': { plan: plan({ status: 'expired' }), isLoaded: true },
    'a plan that is not known yet': {},
  };

  for (const [name, state] of Object.entries(plans)) {
    it(`shows the brief to a person on ${name}, at once, with no lock`, async () => {
      setStore(state);
      const utils = await show();
      expect(utils.getByTestId('today-brief')).toBeTruthy();
      expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
      expect(utils.queryByTestId('today-brief-locked')).toBeNull();
      expect(getTodayBrief).toHaveBeenCalledTimes(1);
    });

    it(`keeps the card on the screen for a person on ${name} when today's brief cannot be written`, async () => {
      setStore(state);
      getTodayBrief.mockResolvedValue(null);
      const utils = await show();
      expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
      expect(utils.queryByTestId('today-brief-locked')).toBeNull();
    });
  }

  it('does not change when the plan does', async () => {
    setStore({ isLoaded: true });
    const utils = await show();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    setStore({ plan: plan({ tier: 'legend' }), isLoaded: true });
    await settle();
    setStore({ plan: plan({ status: 'expired' }), isLoaded: true });
    await settle();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
  });
});

describe('coming back to the screen', () => {
  it('shows the brief straight away, with no skeleton, when this run of the app has already read it', async () => {
    peekTodayBrief.mockReturnValue(BRIEF);
    getTodayBrief.mockReturnValue(new Promise(() => {})); // the read is still on its way
    const utils = render(<TodayBriefCard />);
    // Nothing has been awaited yet: the first render already has it.
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
    expect(peekTodayBrief).toHaveBeenCalledWith({ user: global.__user });
    await settle();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
  });

  it('shows the skeleton on the first render when it has not', () => {
    getTodayBrief.mockReturnValue(new Promise(() => {}));
    const utils = render(<TodayBriefCard />);
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
  });

  it('keeps the brief on the screen when it is read again and the read gives nothing', async () => {
    peekTodayBrief.mockReturnValue(BRIEF);
    getTodayBrief.mockResolvedValue(null);
    const utils = await show();
    expect(utils.queryByTestId('today-brief-missing')).toBeNull();
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
  });
});

describe("when today's brief cannot be written", () => {
  beforeEach(() => { getTodayBrief.mockResolvedValue(null); });

  it('shows the last brief that was kept, with its day, a note that today\'s is not ready, and the footnote', async () => {
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Take it easy');
    expect(OLDER.points.map((_, i) => utils.getByTestId(`today-brief-point-${i}`).props.children)).toEqual(OLDER.points);
    expect(utils.getByTestId('today-brief-day').props.children).toBe('From Sun, Oct 25');
    expect(utils.getByTestId('today-brief-earlier-note').props.children).toBe(BRIEF_EARLIER_NOTE);
    expect(BRIEF_EARLIER_NOTE).toMatch(/not ready yet/);
    expect(utils.getByTestId('today-brief-note').props.children).toBe(BRIEF_FOOTNOTE);
    expect(utils.getByTestId('today-brief-try-again')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
    expect(utils.queryByTestId('today-brief-missing')).toBeNull();
  });

  it('looks for the last brief for this person', async () => {
    getLastBrief.mockResolvedValue(EARLIER);
    await show();
    expect(getLastBrief).toHaveBeenCalledTimes(1);
    expect(getLastBrief).toHaveBeenCalledWith({ user: global.__user });
  });

  it('says it is not ready, with a button to try again, when nothing was kept either', async () => {
    const utils = await show();
    expect(utils.toJSON()).not.toBeNull();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    expect(utils.getByTestId('today-brief-missing-text').props.children).toBe(BRIEF_NOT_READY_TEXT);
    expect(BRIEF_NOT_READY_TEXT).toMatch(/not written today's brief yet/);
    expect(textOf(utils)).toContain('Today brief');
    const button = utils.getByTestId('today-brief-try-again');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe("Try again to write today's brief");
    expect(textOf(utils)).toContain('Try again');
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(utils.queryByTestId('today-brief-headline')).toBeNull();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
  });

  it('is the same when asking for it fails, with no error', async () => {
    getTodayBrief.mockRejectedValue(new Error('offline'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = await show();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
  });

  it('is the same when asking for it throws before it returns', async () => {
    getTodayBrief.mockImplementation(() => { throw new Error('boom'); });
    const utils = await show();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
  });

  it('is the not-ready card, not a crash, when looking for the last brief fails', async () => {
    getLastBrief.mockRejectedValue(new Error('storage'));
    const utils = await show();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
  });

  it('is the not-ready card when what was kept has no brief in it', async () => {
    getLastBrief.mockResolvedValue({ brief: null, day: '2026-10-25' });
    const utils = await show();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
  });

  it('is the same on every plan, and never null', async () => {
    for (const state of [{ isLoaded: true }, { plan: plan(), isLoaded: true }, { plan: plan({ tier: 'legend' }), isLoaded: true }, {}]) {
      setStore(state);
      const utils = await show();
      expect(utils.toJSON()).not.toBeNull();
      utils.unmount();
    }
  });
});

describe('trying again', () => {
  it('asks again, ignoring a failed try that was remembered, and shows today\'s brief when it comes', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    expect(getTodayBrief).toHaveBeenLastCalledWith({ user: global.__user });

    const written = later();
    getTodayBrief.mockReturnValueOnce(written.promise);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(2);
    expect(getTodayBrief).toHaveBeenLastCalledWith({ user: global.__user, retry: true });

    await act(async () => { written.finish(BRIEF); });
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(utils.queryByTestId('today-brief-try-again')).toBeNull();
    expect(utils.queryByTestId('today-brief-earlier-note')).toBeNull();
  });

  it('keeps the earlier brief on the screen, with the button busy, while it tries', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    const written = later();
    getTodayBrief.mockReturnValueOnce(written.promise);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-loading')).toBeNull();
    const button = utils.getByTestId('today-brief-try-again');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(textOf(utils)).not.toContain('Try again');
    await act(async () => { written.finish(null); });
  });

  it('puts the button back, with the earlier brief still there, when the try fails too', async () => {
    getTodayBrief.mockResolvedValue(null);
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
    expect(utils.getByTestId('today-brief-try-again').props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(textOf(utils)).toContain('Try again');
  });

  it('asks only once when the button is pressed again while it is trying', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    const utils = await show();
    const written = later();
    getTodayBrief.mockReturnValueOnce(written.promise);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(2);
    await act(async () => { written.finish(BRIEF); });
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });

  it('works from the not-ready card too', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    const utils = await show();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    const written = later();
    getTodayBrief.mockReturnValueOnce(written.promise);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    expect(utils.getByTestId('today-brief-try-again').props.accessibilityState.busy).toBe(true);
    await act(async () => { written.finish(BRIEF); });
    expect(utils.getByTestId('today-brief')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-missing')).toBeNull();
  });

  it('shows the earlier brief afterwards when a try from the not-ready card fails and one has been kept meanwhile', async () => {
    getTodayBrief.mockResolvedValue(null);
    const utils = await show();
    getLastBrief.mockResolvedValue(EARLIER);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
    expect(utils.queryByTestId('today-brief-missing')).toBeNull();
  });

  it('is the not-ready card again, with no error, when the try throws', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    const utils = await show();
    getTodayBrief.mockRejectedValueOnce(new Error('offline'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(utils.getByTestId('today-brief-missing')).toBeTruthy();
    expect(utils.getByTestId('today-brief-try-again').props.accessibilityState.busy).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  it('can be tried again after a failed try', async () => {
    getTodayBrief.mockResolvedValue(null);
    const utils = await show();
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    getTodayBrief.mockResolvedValue(BRIEF);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(3);
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });
});

describe('what is on the screen render by render', () => {
  // render() and rerender() run effects before they return, so the render before an effect has run is only seen by looking at each commit.
  const watch = () => {
    const commits = [];
    const box = {};
    const Watched = () => (
      <React.Profiler id="brief" onRender={() => { if (box.utils) commits.push(JSON.stringify(box.utils.toJSON())); }}>
        <TodayBriefCard />
      </React.Profiler>
    );
    return { commits, box, Watched };
  };

  it('never shows the last person\'s brief to the next person, not even for the one render before it has caught up', async () => {
    const { commits, box, Watched } = watch();
    box.utils = render(<Watched />);
    await settle();
    expect(commits.some((c) => c.includes('A good day to train'))).toBe(true);
    commits.length = 0;
    getTodayBrief.mockReturnValue(new Promise(() => {}));
    global.__user = { uid: 'u2', name: 'Alex' };
    box.utils.rerender(<Watched />);
    await settle();
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.filter((c) => c.includes('A good day to train'))).toEqual([]);
    expect(commits[commits.length - 1]).toContain('Writing your brief');
  });

  it('never shows the last person\'s earlier brief to the next person either', async () => {
    getTodayBrief.mockResolvedValue(null);
    getLastBrief.mockResolvedValue(EARLIER);
    const { commits, box, Watched } = watch();
    box.utils = render(<Watched />);
    await settle();
    expect(commits.some((c) => c.includes('Take it easy'))).toBe(true);
    commits.length = 0;
    getTodayBrief.mockReturnValue(new Promise(() => {}));
    global.__user = { uid: 'u2', name: 'Alex' };
    box.utils.rerender(<Watched />);
    await settle();
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.filter((c) => c.includes('Take it easy'))).toEqual([]);
  });
});

describe('a different person, and nobody', () => {
  it('asks again for a different person, and not before', async () => {
    const utils = await show();
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(2);
    expect(getTodayBrief).toHaveBeenLastCalledWith({ user: { uid: 'u2', name: 'Alex' } });
  });

  it('shows nothing of an old brief to the next person, while theirs is written', async () => {
    const utils = await show();
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    // Not even for the one render before the effect has run.
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.queryByText('A good day to train')).toBeNull();
    await settle();
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    await act(async () => { written.finish({ headline: 'Alex day', points: ['Go.'] }); });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Alex day');
  });

  it('shows nothing of the last person\'s earlier brief to the next person either', async () => {
    getTodayBrief.mockResolvedValue(null);
    getLastBrief.mockResolvedValue(EARLIER);
    const utils = await show();
    expect(utils.getByTestId('today-brief-earlier')).toBeTruthy();
    getTodayBrief.mockReturnValue(new Promise(() => {}));
    getLastBrief.mockResolvedValue(null);
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    expect(utils.queryByText('Take it easy')).toBeNull();
    await settle();
    expect(utils.queryByText('Take it easy')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
  });

  it('uses the next person\'s brief from this run of the app, not the last person\'s, for the first render', async () => {
    const ALEX = { headline: 'Alex day', points: ['Go.'] };
    peekTodayBrief.mockImplementation(({ user }) => (user.uid === 'u1' ? BRIEF : ALEX));
    getTodayBrief.mockImplementation(async ({ user }) => (user.uid === 'u1' ? BRIEF : ALEX));
    const utils = render(<TodayBriefCard />);
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('A good day to train');
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    expect(utils.getByTestId('today-brief-headline').props.children).not.toBe('A good day to train');
    await settle();
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Alex day');
  });

  it('does not show the brief of the person before, if it only arrives after the next person\'s is being written', async () => {
    const finish = {};
    getTodayBrief.mockImplementation(({ user }) => new Promise((resolve) => { finish[user.uid] = resolve; }));
    const utils = await show();
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    await act(async () => { finish.u1({ headline: 'Sam day', points: ['Old.'] }); });
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    await act(async () => { finish.u2({ headline: 'Alex day', points: ['New.'] }); });
    expect(utils.getByTestId('today-brief-headline').props.children).toBe('Alex day');
  });

  it('does not show the earlier brief of the person before, if it only arrives after the next person\'s is being written', async () => {
    const earlier = later();
    getTodayBrief.mockImplementation(({ user }) => (user.uid === 'u1' ? Promise.resolve(null) : new Promise(() => {})));
    getLastBrief.mockReturnValue(earlier.promise);
    const utils = await show();
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    await act(async () => { earlier.finish(EARLIER); });
    expect(utils.queryByTestId('today-brief-earlier')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
  });

  it('ignores a try from the person before when it ends after the next person has come', async () => {
    getTodayBrief.mockResolvedValueOnce(null);
    const utils = await show();
    const written = later();
    getTodayBrief.mockReturnValueOnce(written.promise);
    fireEvent.press(utils.getByTestId('today-brief-try-again'));
    await settle();
    getTodayBrief.mockReturnValue(new Promise(() => {}));
    global.__user = { uid: 'u2', name: 'Alex' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    await act(async () => { written.finish(BRIEF); });
    expect(utils.queryByTestId('today-brief')).toBeNull();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
  });

  it('does not set anything on a screen that has gone, when the brief arrives late', async () => {
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const utils = await show();
    utils.unmount();
    await act(async () => { written.finish(BRIEF); });
    expect(error).not.toHaveBeenCalled();
  });

  it('does not look for an earlier brief on a screen that has gone', async () => {
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    const utils = await show();
    utils.unmount();
    await act(async () => { written.finish(null); });
    expect(getLastBrief).not.toHaveBeenCalled();
  });

  it('is written for the person as they are when it is asked for, not as they were when the screen opened', async () => {
    const utils = await show();
    global.__user = { uid: 'u1', name: 'Samuel' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(getTodayBrief).toHaveBeenCalledTimes(1);
    expect(getTodayBrief).toHaveBeenCalledWith({ user: { uid: 'u1', name: 'Sam' } });
  });

  it('stops showing the skeleton, and shows no brief, when the person signs out while it is being written', async () => {
    const written = later();
    getTodayBrief.mockReturnValue(written.promise);
    const utils = await show();
    expect(utils.getByTestId('today-brief-loading')).toBeTruthy();
    global.__user = null;
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(utils.toJSON()).toBeNull();
    await act(async () => { written.finish(BRIEF); });
    expect(utils.toJSON()).toBeNull();
  });

  it('shows nothing, to anyone, with nobody signed in, and asks for nothing', async () => {
    for (const user of [null, undefined, {}]) {
      global.__user = user;
      setStore({ isLoaded: true });
      const utils = await show();
      expect(utils.toJSON()).toBeNull();
      setStore({ plan: plan(), isLoaded: true });
      await settle();
      expect(utils.toJSON()).toBeNull();
      utils.unmount();
    }
    expect(getTodayBrief).not.toHaveBeenCalled();
    expect(getLastBrief).not.toHaveBeenCalled();
    expect(peekTodayBrief).not.toHaveBeenCalled();
  });

  it('comes back with the brief when a person signs in', async () => {
    global.__user = null;
    const utils = await show();
    expect(utils.toJSON()).toBeNull();
    global.__user = { uid: 'u1', name: 'Sam' };
    utils.rerender(<TodayBriefCard />);
    await settle();
    expect(utils.getByTestId('today-brief')).toBeTruthy();
  });
});

describe('the day above an earlier brief', () => {
  it('is the weekday, the month and the day', () => {
    expect(briefDayLabel('2026-10-25')).toBe('Sun, Oct 25');
    expect(briefDayLabel('2026-01-02')).toBe('Fri, Jan 2');
    expect(briefDayLabel('2026-12-31')).toBe('Thu, Dec 31');
  });

  it('is the text as it came when it is not a real day, and empty for nothing', () => {
    expect(briefDayLabel('2026-02-31')).toBe('2026-02-31');
    expect(briefDayLabel('yesterday')).toBe('yesterday');
    expect(briefDayLabel(undefined)).toBe('');
    expect(briefDayLabel(null)).toBe('');
  });
});
