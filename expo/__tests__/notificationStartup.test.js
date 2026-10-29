// What the app does with notifications from the moment it starts (services/notificationStartup.js): show a notification that arrives
// while the app is open, and follow the Notifications switch, clearing what is already set when it goes off and setting the calendar's
// reminders again when it comes back on.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
const mockSetupHandler = jest.fn();
const mockCancelByType = jest.fn(async () => undefined);
jest.mock('../services/notificationService', () => ({
  notificationService: {
    setupNotificationHandler: (...a) => mockSetupHandler(...a),
    cancelNotificationsByType: (...a) => mockCancelByType(...a),
  },
}));
const mockReconcile = jest.fn(async () => ({ scheduled: 0, blocked: false }));
jest.mock('../services/calendarReminders', () => ({ reconcileReminders: (...a) => mockReconcile(...a) }));
const mockCancelFast = jest.fn(async () => undefined);
jest.mock('../services/fastingAlert', () => ({ cancelFastAlert: (...a) => mockCancelFast(...a) }));

const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

let startNotifications;
let store;
let warn;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockCancelByType.mockImplementation(async () => undefined);
  mockReconcile.mockImplementation(async () => ({ scheduled: 0, blocked: false }));
  mockCancelFast.mockImplementation(async () => undefined);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  ({ startNotifications } = require('../services/notificationStartup'));
  store = require('../store/settingsStore').useSettingsStore;
  store.setState({ notifications: true });
});
afterEach(() => warn.mockRestore());

describe('startNotifications', () => {
  it('registers the handler that shows a notification while the app is open, once however often it is called', () => {
    startNotifications();
    startNotifications();
    startNotifications();
    expect(mockSetupHandler).toHaveBeenCalledTimes(1);
  });

  it('does nothing to the reminders just by starting', async () => {
    startNotifications();
    await flush();
    expect(mockCancelFast).not.toHaveBeenCalled();
    expect(mockCancelByType).not.toHaveBeenCalled();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('on turning the switch off: clears the fasting alert and the cooking timers, and the calendar reminders', async () => {
    startNotifications();
    store.getState().updateSetting('notifications', false);
    await flush();
    expect(mockCancelFast).toHaveBeenCalledTimes(1);
    expect(mockCancelByType).toHaveBeenCalledWith('cooking-timer');
    // Calendar reminders are cleared by rebuilding them, which sets none while the switch is off.
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('on turning the switch back on: sets the calendar reminders again, and cancels nothing', async () => {
    startNotifications();
    store.getState().updateSetting('notifications', false);
    await flush();
    jest.clearAllMocks();
    store.getState().updateSetting('notifications', true);
    await flush();
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockCancelFast).not.toHaveBeenCalled();
    expect(mockCancelByType).not.toHaveBeenCalled();
  });

  it('does nothing for a change to some other setting, or when the switch is set to what it already was', async () => {
    startNotifications();
    store.getState().updateSetting('darkMode', true);
    store.getState().updateSetting('notifications', true);
    store.getState().updateSetting('units', 'metric');
    await flush();
    expect(mockCancelFast).not.toHaveBeenCalled();
    expect(mockCancelByType).not.toHaveBeenCalled();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('acts once for each time the switch changes', async () => {
    startNotifications();
    store.getState().updateSetting('notifications', false);
    store.getState().updateSetting('notifications', false);
    await flush();
    expect(mockCancelFast).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('notices the switch being turned off in saved settings that load after start (set on another phone)', async () => {
    startNotifications();
    store.setState({ notifications: false });
    await flush();
    expect(mockCancelFast).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('starting with the switch already off: turning it on sets the calendar reminders', async () => {
    store.setState({ notifications: false });
    startNotifications();
    await flush();
    expect(mockReconcile).not.toHaveBeenCalled();
    store.getState().updateSetting('notifications', true);
    await flush();
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('an unset switch counts as on, so the first save of false is a change', async () => {
    store.setState({ notifications: undefined });
    startNotifications();
    store.getState().updateSetting('notifications', false);
    await flush();
    expect(mockCancelFast).toHaveBeenCalledTimes(1);
  });

  it('a switch that becomes unset is still on, so nothing is cleared', async () => {
    startNotifications();
    store.setState({ notifications: undefined });
    await flush();
    expect(mockCancelFast).not.toHaveBeenCalled();
    expect(mockCancelByType).not.toHaveBeenCalled();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('a step that fails does not stop the others, and nothing is thrown', async () => {
    mockCancelByType.mockRejectedValueOnce(new Error('could not read the scheduled list'));
    startNotifications();
    store.getState().updateSetting('notifications', false);
    await flush();
    expect(mockCancelFast).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('clear the cooking timers'), 'could not read the scheduled list');
  });

  it('a failure to rebuild the calendar reminders is reported, not thrown', async () => {
    mockReconcile.mockRejectedValueOnce(new Error('nope'));
    startNotifications();
    store.getState().updateSetting('notifications', true);
    store.getState().updateSetting('notifications', false);
    await flush();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('update the calendar reminders'), 'nope');
  });
});
