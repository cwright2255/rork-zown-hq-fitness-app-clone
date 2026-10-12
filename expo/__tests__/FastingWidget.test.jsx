import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

let mockMeals = [];
let mockWeightLogs = [];
let mockUnits = 'imperial';
const mockLoadWeightLogs = jest.fn();

jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (sel) => sel({ weightUnits: mockUnits }) }));
jest.mock('@/store/nutritionStore', () => ({ useNutritionStore: (sel) => sel({ meals: mockMeals }) }));
jest.mock('@/store/weightLogStore', () => ({
  useWeightLogStore: (sel) => sel({ logs: mockWeightLogs, loadLogs: mockLoadWeightLogs }),
}));
jest.mock('@/services/fastingService', () => ({
  getActiveFast: jest.fn(),
  startFast: jest.fn(),
  endFast: jest.fn(),
  updateFastStart: jest.fn(),
  getFastHistory: jest.fn(),
  deleteFast: jest.fn(),
}));
jest.mock('@/services/fastingAlert', () => ({
  scheduleFastAlert: jest.fn(),
  cancelFastAlert: jest.fn(),
}));

import FastingWidget from '../components/FastingWidget';
import * as service from '@/services/fastingService';
import * as alerts from '@/services/fastingAlert';

const H = 3600000;
// Monday 12 October 2026, 2:00 PM.
const NOW = new Date(2026, 9, 12, 14, 0, 0);

const textOf = (node) => [].concat(node.props.children).flat(Infinity)
  .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : (c && c.props ? textOf({ props: c.props }) : '')))
  .join('');

// A saved fast that ended at `endH`:00 on the given day, after `hours` hours.
const saved = (y, mo, d, hours, target = 16, endH = 12, plan = null) => {
  const endedAt = new Date(y, mo - 1, d, endH, 0, 0);
  return { id: `${y}${mo}${d}-${endH}-${hours}`, startedAt: new Date(endedAt.getTime() - hours * H), endedAt, targetHours: target, plan };
};

const flush = async () => { for (let i = 0; i < 6; i += 1) await act(async () => {}); };

async function setup({ active = null, history = [] } = {}) {
  service.getActiveFast.mockResolvedValue(active);
  service.getFastHistory.mockResolvedValue(history);
  const utils = render(<FastingWidget />);
  await flush();
  return utils;
}
const open = async (utils, tab) => {
  fireEvent.press(utils.getByTestId('fasting-card'));
  await flush();
  if (tab) {
    fireEvent.press(utils.getByTestId(`fasting-tab-${tab}`));
    await flush();
  }
};
const press = async (utils, id) => {
  fireEvent.press(utils.getByTestId(id));
  await flush();
};

let alertSpy;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockMeals = [];
  mockWeightLogs = [];
  mockUnits = 'imperial';
  mockLoadWeightLogs.mockReset();
  Object.values(service).filter((fn) => typeof fn === 'function').forEach((fn) => fn.mockReset());
  Object.values(alerts).filter((fn) => typeof fn === 'function').forEach((fn) => fn.mockReset());
  alerts.scheduleFastAlert.mockResolvedValue('scheduled');
  alerts.cancelFastAlert.mockResolvedValue(undefined);
  service.getFastHistory.mockResolvedValue([]);
  service.startFast.mockImplementation(async (uid, targetHours, { plan }) => ({ startedAt: new Date(), targetHours, plan }));
  service.endFast.mockImplementation(async (uid, active, endedAt) => {
    const ms = endedAt - active.startedAt;
    return {
      saved: true,
      entry: {
        id: String(active.startedAt.getTime()), startedAt: active.startedAt, endedAt, targetHours: active.targetHours, plan: active.plan,
        hours: ms / H, completed: ms >= active.targetHours * H, saveable: ms >= 600000,
      },
    };
  });
  service.updateFastStart.mockResolvedValue(undefined);
  service.deleteFast.mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  Linking.openSettings = jest.fn();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the card on the home screen', () => {
  it('shows a dash and Elapsed when no fast is running, and reads no history', async () => {
    const utils = await setup();
    expect(utils.getByText('Fasting Timer')).toBeTruthy();
    expect(utils.getByText('—')).toBeTruthy();
    expect(utils.getByText('Elapsed')).toBeTruthy();
    expect(service.getFastHistory).not.toHaveBeenCalled();
  });

  it('shows the time fasted so far and the target for a fast that is running', async () => {
    const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 6 * H - 5 * 60000), targetHours: 16, plan: '16' } });
    expect(utils.getByText('6:05')).toBeTruthy();
    expect(utils.getByText('of 16h')).toBeTruthy();
  });

  it('says Goal reached once the target has passed', async () => {
    const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16, plan: '16' } });
    expect(utils.getByText('17:00')).toBeTruthy();
    expect(utils.getByText('Goal reached')).toBeTruthy();
    expect(utils.queryByText('of 16h')).toBeNull();
  });

  it('counts up every second while a fast is running', async () => {
    const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 60000), targetHours: 16, plan: null } });
    expect(utils.getByText('0:01')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(utils.getByText('0:02')).toBeTruthy();
  });

  it('schedules the goal alert again for a fast already running, without asking for permission', async () => {
    const active = { startedAt: new Date(NOW.getTime() - 6 * H), targetHours: 16, plan: '16' };
    await setup({ active });
    expect(alerts.scheduleFastAlert).toHaveBeenCalledTimes(1);
    expect(alerts.scheduleFastAlert).toHaveBeenCalledWith(active);
  });

  it('does not schedule an alert when there is no fast', async () => {
    await setup();
    expect(alerts.scheduleFastAlert).not.toHaveBeenCalled();
  });

  it('opens and closes when tapped, and reads the history once it is opened', async () => {
    const utils = await setup();
    await open(utils);
    expect(utils.getByTestId('fasting-tab-fast')).toBeTruthy();
    expect(service.getFastHistory).toHaveBeenCalledTimes(1);
    expect(service.getFastHistory).toHaveBeenCalledWith('u1');
    fireEvent.press(utils.getByTestId('fasting-card'));
    await flush();
    expect(utils.queryByTestId('fasting-tab-fast')).toBeNull();
    fireEvent.press(utils.getByTestId('fasting-card'));
    await flush();
    expect(service.getFastHistory).toHaveBeenCalledTimes(1); // not read again
  });

  it('copes with a fast that could not be loaded', async () => {
    service.getActiveFast.mockRejectedValue(new Error('offline'));
    const utils = render(<FastingWidget />);
    await flush();
    expect(utils.getByText('Elapsed')).toBeTruthy();
  });
});

describe('choosing a plan', () => {
  it('offers 13h, 16h, 18h, 20h, OMAD, 24h, 36h and Custom, with 16h chosen', async () => {
    const utils = await setup();
    await open(utils);
    ['13h', '16h', '18h', '20h', 'OMAD', '24h', '36h', 'Custom'].forEach((label) => expect(utils.getByText(label)).toBeTruthy());
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('16:8 · fast for 16 hours');
  });

  it('describes the plan that is picked', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-plan-omad');
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('One meal a day · fast for 23 hours');
    await press(utils, 'fasting-plan-13');
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('Circadian · fast for 13 hours');
  });

  it('starts the picked plan: its hours, and its plan id', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-plan-omad');
    await press(utils, 'fasting-start');
    expect(service.startFast).toHaveBeenCalledTimes(1);
    expect(service.startFast).toHaveBeenCalledWith('u1', 23, { plan: 'omad' });
    expect(utils.getByText('of 23h')).toBeTruthy();
    expect(utils.getByTestId('fasting-end')).toBeTruthy();
  });

  it('starts on 16 hours if nothing else is picked', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-start');
    expect(service.startFast).toHaveBeenCalledWith('u1', 16, { plan: '16' });
  });

  it('asks for permission to send the goal alert when a fast starts, and remembers how that went', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-start');
    expect(alerts.scheduleFastAlert).toHaveBeenCalledTimes(1);
    const [fast, options] = alerts.scheduleFastAlert.mock.calls[0];
    expect(fast).toMatchObject({ targetHours: 16, plan: '16' });
    expect(options).toEqual({ ask: true });
    expect(utils.queryByTestId('fasting-alert-note')).toBeNull();
  });

  it('shows a Custom stepper, starting at 16 hours, and starts the length chosen with it', async () => {
    const utils = await setup();
    await open(utils);
    expect(utils.queryByTestId('fasting-custom-value')).toBeNull();
    await press(utils, 'fasting-plan-custom');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('16h');
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('fast for 16 hours');
    await press(utils, 'fasting-custom-6');
    await press(utils, 'fasting-custom-6');
    await press(utils, 'fasting-custom-1');
    await press(utils, 'fasting-custom--1');
    await press(utils, 'fasting-custom--1');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('27h');
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('fast for 27 hours');
    await press(utils, 'fasting-start');
    expect(service.startFast).toHaveBeenCalledWith('u1', 27, { plan: 'custom' });
    expect(utils.getByText('of 27h')).toBeTruthy();
  });

  it('remembers the custom length while another plan is looked at', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-plan-custom');
    await press(utils, 'fasting-custom--6');
    await press(utils, 'fasting-plan-omad');
    expect(utils.queryByTestId('fasting-custom-value')).toBeNull();
    await press(utils, 'fasting-plan-custom');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('10h');
  });

  it('stops the custom length at 1 hour and at 72 hours', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-plan-custom');
    for (let i = 0; i < 12; i += 1) await press(utils, 'fasting-custom-6');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('72h');
    await press(utils, 'fasting-custom-1');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('72h');
    for (let i = 0; i < 14; i += 1) await press(utils, 'fasting-custom--6');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('1h');
    expect(textOf(utils.getByTestId('fasting-plan-summary'))).toBe('fast for 1 hour');
    await press(utils, 'fasting-custom--1');
    expect(textOf(utils.getByTestId('fasting-custom-value'))).toBe('1h');
    await press(utils, 'fasting-start');
    expect(service.startFast).toHaveBeenCalledWith('u1', 1, { plan: 'custom' });
  });

  it('shows the doctor note above 24 hours and not at or below it', async () => {
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-plan-24');
    expect(utils.queryByTestId('fasting-long-note')).toBeNull();
    await press(utils, 'fasting-plan-36');
    expect(textOf(utils.getByTestId('fasting-long-note'))).toMatch(/doctor/i);
    await press(utils, 'fasting-plan-custom');
    expect(utils.queryByTestId('fasting-long-note')).toBeNull(); // 16 hours
    for (let i = 0; i < 9; i += 1) await press(utils, 'fasting-custom-1'); // 25 hours
    expect(utils.getByTestId('fasting-long-note')).toBeTruthy();
    await press(utils, 'fasting-custom--1'); // 24 hours
    expect(utils.queryByTestId('fasting-long-note')).toBeNull();
  });

  it('tells the person when the fast could not be started, and shows no fast', async () => {
    service.startFast.mockRejectedValue(new Error('offline'));
    const utils = await setup();
    await open(utils);
    await press(utils, 'fasting-start');
    expect(alertSpy).toHaveBeenCalledWith('Could not start your fast', expect.any(String));
    expect(utils.queryByTestId('fasting-end')).toBeNull();
    expect(alerts.scheduleFastAlert).not.toHaveBeenCalled();
  });
});

describe('the fast that is running', () => {
  const active = () => ({ startedAt: new Date(NOW.getTime() - 6 * H), targetHours: 23, plan: 'omad' });

  it('shows the target by name, the time to go, when the goal is, and when it started', async () => {
    const utils = await setup({ active: active() });
    await open(utils);
    expect(textOf(utils.getByText(/^Target:/))).toBe('Target: OMAD · One meal a day');
    expect(textOf(utils.getByTestId('fasting-status'))).toBe('17h to go');
    expect(textOf(utils.getByTestId('fasting-goal-time'))).toBe('Goal: Tuesday'.replace('Tuesday', 'Tue, Oct 13, 7:00 AM'));
    expect(textOf(utils.getByTestId('fasting-started'))).toBe('Started Today, 8:00 AM');
  });

  it('shows a custom or older fast by its hours', async () => {
    const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 2 * H), targetHours: 30, plan: 'custom' } });
    await open(utils);
    expect(textOf(utils.getByText(/^Target:/))).toBe('Target: 30h');
  });

  it('says how long past the goal it has gone', async () => {
    const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 17.5 * H), targetHours: 16, plan: '16' } });
    await open(utils);
    expect(textOf(utils.getByTestId('fasting-status'))).toBe('Goal reached · 1h 30m over');
  });

  describe('moving the start time', () => {
    it('opens an editor showing the start time, and Cancel leaves it as it was', async () => {
      const utils = await setup({ active: active() });
      await open(utils);
      await press(utils, 'fasting-edit-start');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 8:00 AM');
      await press(utils, 'fasting-nudge--60');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 7:00 AM');
      await press(utils, 'fasting-edit-cancel');
      expect(utils.queryByTestId('fasting-editor')).toBeNull();
      expect(textOf(utils.getByTestId('fasting-started'))).toBe('Started Today, 8:00 AM');
      expect(service.updateFastStart).not.toHaveBeenCalled();
    });

    it('moves the start by an hour or fifteen minutes, either way', async () => {
      const utils = await setup({ active: active() });
      await open(utils);
      await press(utils, 'fasting-edit-start');
      await press(utils, 'fasting-nudge--15');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 7:45 AM');
      await press(utils, 'fasting-nudge--60');
      await press(utils, 'fasting-nudge--60');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 5:45 AM');
      await press(utils, 'fasting-nudge-15');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 6:00 AM');
      await press(utils, 'fasting-nudge-60');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 7:00 AM');
    });

    it('saves the new start, updates the timer and the goal, and sets the alert again for the new goal time', async () => {
      const utils = await setup({ active: active() });
      await open(utils);
      alerts.scheduleFastAlert.mockClear();
      await press(utils, 'fasting-edit-start');
      await press(utils, 'fasting-nudge--60');
      await press(utils, 'fasting-nudge--60');
      await press(utils, 'fasting-edit-save');

      const newStart = new Date(NOW.getTime() - 8 * H);
      expect(service.updateFastStart).toHaveBeenCalledTimes(1);
      expect(service.updateFastStart).toHaveBeenCalledWith('u1', newStart);
      expect(alerts.scheduleFastAlert).toHaveBeenCalledTimes(1);
      expect(alerts.scheduleFastAlert.mock.calls[0][0]).toEqual({ startedAt: newStart, targetHours: 23, plan: 'omad' });
      expect(utils.queryByTestId('fasting-editor')).toBeNull();
      expect(textOf(utils.getByTestId('fasting-started'))).toBe('Started Today, 6:00 AM');
      expect(textOf(utils.getByTestId('fasting-status'))).toBe('15h to go');
      expect(utils.getByText('8:00')).toBeTruthy();
    });

    it('can not move the start into the future', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 10 * 60000), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-edit-start');
      await press(utils, 'fasting-nudge-60');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 2:00 PM');
      await press(utils, 'fasting-nudge-15');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Today, 2:00 PM');
    });

    it('can not move the start more than 72 hours back', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 71.5 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-edit-start');
      await press(utils, 'fasting-nudge--60');
      await press(utils, 'fasting-nudge--60');
      expect(textOf(utils.getByTestId('fasting-draft'))).toBe('Fri, Oct 9, 2:00 PM');
    });

    it('keeps the old start when it can not be saved', async () => {
      service.updateFastStart.mockRejectedValue(new Error('offline'));
      const utils = await setup({ active: active() });
      await open(utils);
      await press(utils, 'fasting-edit-start');
      await press(utils, 'fasting-nudge--60');
      await press(utils, 'fasting-edit-save');
      expect(alertSpy).toHaveBeenCalledWith('Could not change the start time', expect.any(String));
      expect(textOf(utils.getByTestId('fasting-editor'))).toBeDefined();
      expect(utils.getByText('6:00')).toBeTruthy();
    });
  });

  describe('the goal alert note', () => {
    it('is not shown when the alert is set', async () => {
      const utils = await setup({ active: active() });
      await open(utils);
      expect(utils.queryByTestId('fasting-alert-note')).toBeNull();
    });

    it('offers to turn notifications on when they are not on yet, and asks when tapped', async () => {
      alerts.scheduleFastAlert.mockResolvedValue('not-allowed');
      const utils = await setup({ active: active() });
      await open(utils);
      expect(textOf(utils.getByTestId('fasting-alert-note'))).toMatch(/turn on notifications/i);
      alerts.scheduleFastAlert.mockClear();
      alerts.scheduleFastAlert.mockResolvedValue('scheduled');
      await press(utils, 'fasting-alert-note');
      expect(alerts.scheduleFastAlert).toHaveBeenCalledTimes(1);
      expect(alerts.scheduleFastAlert.mock.calls[0][1]).toEqual({ ask: true });
      expect(utils.queryByTestId('fasting-alert-note')).toBeNull();
    });

    it('sends the person to Settings when the phone will not ask again', async () => {
      alerts.scheduleFastAlert.mockResolvedValue('blocked');
      const utils = await setup({ active: active() });
      await open(utils);
      expect(textOf(utils.getByTestId('fasting-alert-note'))).toMatch(/settings/i);
      alerts.scheduleFastAlert.mockClear();
      await press(utils, 'fasting-alert-note');
      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
      expect(alerts.scheduleFastAlert).not.toHaveBeenCalled();
    });
  });

  describe('ending the fast', () => {
    it('ends it, cancels the goal alert, and says how it went', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 16.5 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(service.endFast).toHaveBeenCalledTimes(1);
      const [uid, fast, endedAt] = service.endFast.mock.calls[0];
      expect(uid).toBe('u1');
      expect(fast).toMatchObject({ targetHours: 16, plan: '16' });
      expect(endedAt).toEqual(NOW);
      expect(alerts.cancelFastAlert).toHaveBeenCalledTimes(1);
      expect(utils.queryByTestId('fasting-end')).toBeNull();
      expect(utils.getByText('Elapsed')).toBeTruthy();
      expect(textOf(utils.getByTestId('fasting-last-result'))).toBe('Saved · 16h 30m · goal reached');
    });

    it('says when the goal was not reached', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 12 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(textOf(utils.getByTestId('fasting-last-result'))).toBe('Saved · 12h · 16h goal not reached');
    });

    it('says a fast under ten minutes was not added', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 4 * 60000), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(textOf(utils.getByTestId('fasting-last-result'))).toMatch(/under 10 minutes/);
    });

    it('says when the fast ended but could not be saved', async () => {
      service.endFast.mockImplementation(async (uid, active, endedAt) => ({
        saved: false,
        entry: { id: 'x', startedAt: active.startedAt, endedAt, targetHours: 16, plan: '16', hours: 17, completed: true, saveable: true },
      }));
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(textOf(utils.getByTestId('fasting-last-result'))).toMatch(/could not be saved/);
      expect(utils.queryByTestId('fasting-end')).toBeNull();
    });

    it('keeps the fast, and its alert, when it can not be ended', async () => {
      service.endFast.mockRejectedValue(new Error('offline'));
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(alertSpy).toHaveBeenCalledWith('Could not end your fast', expect.any(String));
      expect(alerts.cancelFastAlert).not.toHaveBeenCalled();
      expect(utils.getByTestId('fasting-end')).toBeTruthy();
    });

    it('shows the result of the latest fast only', async () => {
      const utils = await setup({ active: { startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16, plan: '16' } });
      await open(utils);
      await press(utils, 'fasting-end');
      expect(utils.getByTestId('fasting-last-result')).toBeTruthy();
      await press(utils, 'fasting-start');
      await press(utils, 'fasting-end');
      expect(textOf(utils.getByTestId('fasting-last-result'))).toMatch(/under 10 minutes/);
    });

    it('adds the finished fast to the top of the history', async () => {
      const older = saved(2026, 10, 11, 16);
      const utils = await setup({
        active: { startedAt: new Date(NOW.getTime() - 17 * H), targetHours: 16, plan: '16' },
        history: [older],
      });
      await open(utils);
      await press(utils, 'fasting-end');
      fireEvent.press(utils.getByTestId('fasting-tab-history'));
      await flush();
      expect(textOf(utils.getByTestId('fasting-total'))).toBe('2');
      const rows = utils.getAllByTestId(/^fasting-row-/);
      expect(rows).toHaveLength(2);
      expect(rows[0].props.testID).toBe(`fasting-row-${new Date(NOW.getTime() - 17 * H).getTime()}`);
      expect(rows[1].props.testID).toBe(`fasting-row-${older.id}`);
    });
  });
});

describe('the History tab', () => {
  it('shows the streak, the best streak and how many fasts', async () => {
    const history = [
      saved(2026, 10, 12, 17), saved(2026, 10, 11, 16), saved(2026, 10, 10, 18), // 3 in a row to today
      saved(2026, 10, 8, 16), saved(2026, 10, 7, 16), saved(2026, 10, 6, 16), saved(2026, 10, 5, 16), saved(2026, 10, 4, 16), // a run of 5
    ];
    const utils = await setup({ history });
    await open(utils, 'history');
    expect(textOf(utils.getByTestId('fasting-streak'))).toBe('3');
    expect(textOf(utils.getByTestId('fasting-best-streak'))).toBe('5');
    expect(textOf(utils.getByTestId('fasting-total'))).toBe('8');
    expect(utils.queryByTestId('fasting-streak-hint')).toBeNull();
  });

  it('reminds the person to finish a fast today to keep the streak', async () => {
    const utils = await setup({ history: [saved(2026, 10, 11, 16), saved(2026, 10, 10, 16)] });
    await open(utils, 'history');
    expect(textOf(utils.getByTestId('fasting-streak'))).toBe('2');
    expect(textOf(utils.getByTestId('fasting-streak-hint'))).toMatch(/keep your streak/);
  });

  it('shows a zero streak once it is broken', async () => {
    const utils = await setup({ history: [saved(2026, 10, 9, 16)] });
    await open(utils, 'history');
    expect(textOf(utils.getByTestId('fasting-streak'))).toBe('0');
    expect(utils.queryByTestId('fasting-streak-hint')).toBeNull();
  });

  it('lists each fast: the day it ended, how long, its plan, and when it started and ended', async () => {
    const f = saved(2026, 10, 11, 16.5, 16, 12, '16');
    const utils = await setup({ history: [f, saved(2026, 10, 10, 23, 23, 9, 'omad')] });
    await open(utils, 'history');
    expect(utils.getByText('Yesterday · 16h 30m')).toBeTruthy();
    expect(utils.getByText('16h goal · 7:30 PM – 12:00 PM')).toBeTruthy();
    expect(utils.getByText('Sat, Oct 10 · 23h')).toBeTruthy();
    expect(utils.getByText('OMAD goal · 10:00 AM – 9:00 AM')).toBeTruthy();
  });

  it('shows only the latest five, then ten more at a time', async () => {
    const history = Array.from({ length: 18 }, (_, i) => saved(2026, 9, 28 - i, 16 + (i % 3)));
    const utils = await setup({ history });
    await open(utils, 'history');
    expect(utils.getAllByTestId(/^fasting-row-/)).toHaveLength(5);
    expect(textOf(utils.getByTestId('fasting-show-more'))).toBe('Show more (13 left)');
    await press(utils, 'fasting-show-more');
    expect(utils.getAllByTestId(/^fasting-row-/)).toHaveLength(15);
    expect(textOf(utils.getByTestId('fasting-show-more'))).toBe('Show more (3 left)');
    await press(utils, 'fasting-show-more');
    expect(utils.getAllByTestId(/^fasting-row-/)).toHaveLength(18);
    expect(utils.queryByTestId('fasting-show-more')).toBeNull();
  });

  it('says so when there are no fasts yet', async () => {
    const utils = await setup({ history: [] });
    await open(utils, 'history');
    expect(textOf(utils.getByTestId('fasting-history-empty'))).toMatch(/No fasts yet/);
    expect(textOf(utils.getByTestId('fasting-streak'))).toBe('0');
  });

  it('shows a loading message while the fasts load', async () => {
    let resolve;
    service.getActiveFast.mockResolvedValue(null);
    service.getFastHistory.mockReturnValue(new Promise((r) => { resolve = r; }));
    const utils = render(<FastingWidget />);
    await flush();
    await open(utils, 'history');
    expect(utils.getByTestId('fasting-history-loading')).toBeTruthy();
    await act(async () => { resolve([saved(2026, 10, 12, 16)]); });
    expect(utils.queryByTestId('fasting-history-loading')).toBeNull();
    expect(textOf(utils.getByTestId('fasting-total'))).toBe('1');
  });

  it('offers to try again when the fasts could not be loaded', async () => {
    service.getActiveFast.mockResolvedValue(null);
    service.getFastHistory.mockRejectedValueOnce(new Error('offline'));
    const utils = render(<FastingWidget />);
    await flush();
    await open(utils, 'history');
    expect(utils.getByTestId('fasting-history-error')).toBeTruthy();
    service.getFastHistory.mockResolvedValue([saved(2026, 10, 12, 16)]);
    await press(utils, 'fasting-history-retry');
    expect(utils.queryByTestId('fasting-history-error')).toBeNull();
    expect(textOf(utils.getByTestId('fasting-total'))).toBe('1');
  });

  describe('removing a fast', () => {
    const f = saved(2026, 10, 11, 16);
    const confirm = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1];

    it('asks first, and does nothing if cancelled', async () => {
      const utils = await setup({ history: [f] });
      await open(utils, 'history');
      await press(utils, `fasting-remove-${f.id}`);
      const [title, , buttons] = confirm();
      expect(title).toBe('Remove this fast?');
      expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Remove']);
      expect(service.deleteFast).not.toHaveBeenCalled();
      expect(utils.getByTestId(`fasting-row-${f.id}`)).toBeTruthy();
    });

    it('removes it from the history, the streak and the count once confirmed', async () => {
      const utils = await setup({ history: [f, saved(2026, 10, 12, 16)] });
      await open(utils, 'history');
      expect(textOf(utils.getByTestId('fasting-streak'))).toBe('2');
      await press(utils, `fasting-remove-${f.id}`);
      await act(async () => { await confirm()[2][1].onPress(); });
      expect(service.deleteFast).toHaveBeenCalledWith('u1', f.id);
      expect(utils.queryByTestId(`fasting-row-${f.id}`)).toBeNull();
      expect(textOf(utils.getByTestId('fasting-total'))).toBe('1');
      expect(textOf(utils.getByTestId('fasting-streak'))).toBe('1');
    });

    it('keeps the fast and says so when it can not be removed', async () => {
      service.deleteFast.mockRejectedValue(new Error('offline'));
      const utils = await setup({ history: [f] });
      await open(utils, 'history');
      await press(utils, `fasting-remove-${f.id}`);
      await act(async () => { await confirm()[2][1].onPress(); });
      expect(alertSpy).toHaveBeenLastCalledWith('Could not remove it', expect.any(String));
      expect(utils.getByTestId(`fasting-row-${f.id}`)).toBeTruthy();
    });
  });
});

describe('the Charts tab: week, month and year', () => {
  const history = [
    saved(2026, 10, 12, 17), saved(2026, 10, 10, 12), saved(2026, 10, 9, 16.5), // this week: 3 fasts, 2 met
    saved(2026, 9, 20, 16), // this month, not this week
    saved(2026, 3, 3, 18), // this year only
  ];

  it('opens on the week, with its bars, a legend and three totals', async () => {
    const utils = await setup({ history });
    await open(utils, 'charts');
    expect(utils.getByText('Last 7 days · hours fasted')).toBeTruthy();
    expect(utils.getByTestId('fast-bar-chart')).toBeTruthy();
    expect(utils.getByText('Goal reached')).toBeTruthy();
    expect(utils.getByText('Ended early')).toBeTruthy();
    expect(textOf(utils.getByTestId('fasting-sum-fasts'))).toBe('3');
    expect(textOf(utils.getByTestId('fasting-sum-avg'))).toBe('15.2h');
    expect(textOf(utils.getByTestId('fasting-sum-met'))).toBe('2/3');
    // Monday (today) is the last of seven bars and is 17 hours tall
    expect(utils.getByTestId('fast-bar-6')).toBeTruthy();
    expect(utils.queryByTestId('fast-bar-0')).toBeNull();
  });

  it('switches to the month and the year', async () => {
    const utils = await setup({ history });
    await open(utils, 'charts');
    await press(utils, 'fasting-range-month');
    expect(utils.getByText('Last 30 days · hours fasted')).toBeTruthy();
    expect(textOf(utils.getByTestId('fasting-sum-fasts'))).toBe('4');
    await press(utils, 'fasting-range-year');
    expect(utils.getByText('Last 12 months · average fast')).toBeTruthy();
    expect(textOf(utils.getByTestId('fasting-sum-fasts'))).toBe('5');
    expect(textOf(utils.getByTestId('fasting-sum-met'))).toBe('4/5');
  });

  it('says so when there are no fasts in the time chosen', async () => {
    const utils = await setup({ history: [saved(2026, 3, 3, 18)] });
    await open(utils, 'charts');
    expect(textOf(utils.getByTestId('fasting-chart-empty'))).toMatch(/No fasts/);
    expect(utils.queryByTestId('fast-bar-chart')).toBeNull();
    await press(utils, 'fasting-range-year');
    expect(utils.getByTestId('fast-bar-chart')).toBeTruthy();
  });

  it('shows a loading message, and offers to try again if the fasts could not be loaded', async () => {
    service.getActiveFast.mockResolvedValue(null);
    service.getFastHistory.mockRejectedValueOnce(new Error('offline'));
    const utils = render(<FastingWidget />);
    await flush();
    await open(utils, 'charts');
    expect(utils.getByTestId('fasting-charts-retry')).toBeTruthy();
    service.getFastHistory.mockResolvedValue(history);
    await press(utils, 'fasting-charts-retry');
    expect(utils.getByTestId('fast-bar-chart')).toBeTruthy();
  });
});

describe('the Charts tab: Compare', () => {
  // Weigh-ins on the Wednesday of six weeks, and a fast each Thursday after the first.
  const weigh = (y, m, d, kg) => ({ weightKg: kg, createdAtLocal: new Date(y, m - 1, d, 8, 0).toISOString() });
  const weights = [
    weigh(2026, 9, 2, 82), weigh(2026, 9, 9, 81.6), weigh(2026, 9, 16, 81), weigh(2026, 9, 23, 81),
    weigh(2026, 9, 30, 80.2), weigh(2026, 10, 7, 79.8),
  ];
  const weekFasts = [
    saved(2026, 9, 10, 14), saved(2026, 9, 17, 16), saved(2026, 9, 24, 12), saved(2026, 10, 1, 18), saved(2026, 10, 8, 20),
  ];
  const compare = async (utils, which) => {
    await open(utils, 'charts');
    await press(utils, 'fasting-range-compare');
    if (which) await press(utils, `fasting-compare-${which}`);
  };

  it('starts on weight, and asks for the weights to be loaded once when there are none', async () => {
    const utils = await setup({ history: weekFasts });
    await compare(utils);
    expect(mockLoadWeightLogs).toHaveBeenCalledTimes(1);
    expect(mockLoadWeightLogs).toHaveBeenCalledWith('u1');
    await press(utils, 'fasting-compare-calories');
    await press(utils, 'fasting-compare-weight');
    expect(mockLoadWeightLogs).toHaveBeenCalledTimes(1);
  });

  it('does not load the weights for the other charts, or when they are already there', async () => {
    mockWeightLogs = weights;
    const utils = await setup({ history: weekFasts });
    await open(utils, 'charts');
    await press(utils, 'fasting-range-month');
    await press(utils, 'fasting-range-year');
    expect(mockLoadWeightLogs).not.toHaveBeenCalled();
    await press(utils, 'fasting-range-compare'); // the weights are already there
    expect(utils.getByTestId('fast-scatter-chart')).toBeTruthy();
    expect(mockLoadWeightLogs).not.toHaveBeenCalled();
  });

  it('does not load the weights while the person is looking at anything else', async () => {
    const utils = await setup({ history: weekFasts });
    await open(utils);
    await press(utils, 'fasting-tab-history');
    await press(utils, 'fasting-tab-charts');
    await press(utils, 'fasting-range-month');
    await press(utils, 'fasting-range-year');
    expect(mockLoadWeightLogs).not.toHaveBeenCalled();
  });

  it('says how many weeks it has when there are not enough yet', async () => {
    const utils = await setup({ history: weekFasts });
    await compare(utils);
    expect(textOf(utils.getByTestId('fasting-compare-need'))).toMatch(/You have 0 of 5/);
    expect(utils.queryByTestId('fast-scatter-chart')).toBeNull();
  });

  it('draws weight change against fast length once there are five weeks, in pounds', async () => {
    mockWeightLogs = weights;
    const utils = await setup({ history: weekFasts });
    await compare(utils);
    expect(utils.getByText('Weight change per week (lb) vs. average fast')).toBeTruthy();
    // the dots are in pounds: the kilograms times 2.20462, so the loss reaches about two pounds a week
    expect(textOf(utils.getByTestId('fast-scatter-y-bottom'))).toBe('\u22122.0');
    expect(textOf(utils.getByTestId('fast-scatter-y-top'))).toBe('+0.2');
    expect(utils.getByTestId('fast-scatter-chart')).toBeTruthy();
    expect(utils.getByTestId('fast-dot-4')).toBeTruthy();
    expect(utils.queryByTestId('fast-dot-5')).toBeNull();
    expect(textOf(utils.getByTestId('fasting-compare-sentence'))).toBe('Across 5 weeks, longer fasts went with moderately lower weight.');
    expect(textOf(utils.getByTestId('fasting-compare-r'))).toMatch(/^r = −0\.64 · a pattern in your numbers, not proof/);
  });

  it('uses kilograms when the weight setting is metric', async () => {
    mockWeightLogs = weights;
    mockUnits = 'metric';
    const utils = await setup({ history: weekFasts });
    await compare(utils);
    expect(utils.getByText('Weight change per week (kg) vs. average fast')).toBeTruthy();
    expect(textOf(utils.getByTestId('fast-scatter-y-bottom'))).toBe('\u22120.9');
    expect(textOf(utils.getByTestId('fast-scatter-y-top'))).toBe('+0.1');
  });

  it('draws calories against the longest fast of the day', async () => {
    mockMeals = [
      { id: 'a', date: '2026-10-08', foods: [{ calories: 2200 }] },
      { id: 'b', date: '2026-10-09', foods: [{ calories: 2000 }] },
      { id: 'c', date: '2026-10-10', foods: [{ calories: 1800 }] },
      { id: 'd', date: '2026-10-11', foods: [{ calories: 1500 }] },
      { id: 'e', date: '2026-10-12', foods: [{ calories: 1200 }] },
    ];
    const fasts = [
      saved(2026, 10, 8, 12), saved(2026, 10, 9, 14), saved(2026, 10, 10, 16), saved(2026, 10, 11, 18), saved(2026, 10, 12, 20),
    ];
    const utils = await setup({ history: fasts });
    await compare(utils, 'calories');
    expect(utils.getByText('Calories logged that day vs. longest fast that day')).toBeTruthy();
    expect(utils.getByTestId('fast-dot-4')).toBeTruthy();
    expect(textOf(utils.getByTestId('fasting-compare-sentence'))).toBe('Across 5 days, longer fasts went with clearly fewer calories logged.');
    expect(textOf(utils.getByTestId('fasting-compare-r'))).toMatch(/^r = −0\.9\d/);
  });

  it('explains what a calorie dot needs when there are not enough', async () => {
    mockMeals = [{ id: 'a', date: '2026-10-12', foods: [{ calories: 1200 }] }];
    const utils = await setup({ history: [saved(2026, 10, 12, 20)] });
    await compare(utils, 'calories');
    expect(textOf(utils.getByTestId('fasting-compare-need'))).toMatch(/food logged. You have 1 of 5/);
  });
});

describe('the tabs', () => {
  it('open on Fast and switch between Fast, History and Charts', async () => {
    const utils = await setup({ history: [saved(2026, 10, 12, 16)] });
    await open(utils);
    expect(utils.getByTestId('fasting-start')).toBeTruthy();
    await press(utils, 'fasting-tab-history');
    expect(utils.queryByTestId('fasting-start')).toBeNull();
    expect(utils.getByTestId('fasting-streak')).toBeTruthy();
    await press(utils, 'fasting-tab-charts');
    expect(utils.queryByTestId('fasting-streak')).toBeNull();
    expect(utils.getByTestId('fasting-range-week')).toBeTruthy();
    await press(utils, 'fasting-tab-fast');
    expect(utils.getByTestId('fasting-start')).toBeTruthy();
  });
});
