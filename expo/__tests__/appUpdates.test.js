// services/appUpdates.js and where the app calls it. A new version of the app is downloaded in the background and used the next time
// the app is opened from scratch. It must never restart the app that is open: at launch Home is already usable, and a restart
// then throws away whatever the person has started (a workout, a meal being logged, a run being recorded).
const fs = require('fs');
const path = require('path');

const mockCheck = jest.fn();
const mockFetch = jest.fn();
const mockReload = jest.fn();
jest.mock('expo-updates', () => ({
  checkForUpdateAsync: (...a) => mockCheck(...a),
  fetchUpdateAsync: (...a) => mockFetch(...a),
  reloadAsync: (...a) => mockReload(...a),
}));

const { fetchUpdateForNextLaunch } = require('../services/appUpdates');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(rel);
  return /\.(js|jsx)$/.test(entry.name) ? [rel] : [];
});
const sources = ['app', 'components', 'hooks', 'lib', 'services', 'src', 'store', 'utils']
  .flatMap((dir) => (fs.existsSync(path.join(root, dir)) ? walk(dir) : []));

let devFlag;
beforeEach(() => {
  mockCheck.mockReset();
  mockFetch.mockReset();
  mockReload.mockReset();
  mockFetch.mockResolvedValue({ isNew: true });
  devFlag = global.__DEV__;
  global.__DEV__ = false; // a real build, which is where updates are looked for
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  global.__DEV__ = devFlag;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('fetchUpdateForNextLaunch', () => {
  it('downloads an update that is waiting, and does not restart the app', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    await expect(fetchUpdateForNextLaunch()).resolves.toBe('downloaded');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('does not restart the app however long the session goes on after the download', async () => {
    jest.useFakeTimers();
    mockCheck.mockResolvedValue({ isAvailable: true });
    await fetchUpdateForNextLaunch();
    await jest.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('downloads nothing when there is nothing new', async () => {
    mockCheck.mockResolvedValue({ isAvailable: false });
    await expect(fetchUpdateForNextLaunch()).resolves.toBe('none');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('carries on with the current version when the check fails (offline, a build without updates)', async () => {
    mockCheck.mockRejectedValue(new Error('offline'));
    await expect(fetchUpdateForNextLaunch()).resolves.toBe('failed');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('carries on with the current version when the download fails part-way', async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockRejectedValue(new Error('connection lost'));
    await expect(fetchUpdateForNextLaunch()).resolves.toBe('failed');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('does not look for updates in development', async () => {
    global.__DEV__ = true;
    await expect(fetchUpdateForNextLaunch()).resolves.toBe('skipped');
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

describe('the root layout', () => {
  const layout = read('app/_layout.jsx');

  it('asks for the update to be downloaded for the next launch, once, when the app starts', () => {
    expect(layout).toContain("import { fetchUpdateForNextLaunch } from '@/services/appUpdates';");
    expect(layout).toMatch(/useEffect\(\(\) => \{\s*void fetchUpdateForNextLaunch\(\);\s*\}, \[\]\);/);
    expect((layout.match(/fetchUpdateForNextLaunch\(/g) || []).length).toBe(1);
  });

  it('does not talk to expo-updates itself, so it cannot restart the app', () => {
    expect(layout).not.toMatch(/expo-updates/);
    expect(layout).not.toMatch(/\bUpdates\./);
    expect(layout).not.toMatch(/reloadAsync/);
  });
});

describe('across the app', () => {
  it('the only restart for an update, or for anything else, is one the person asked for in Settings', () => {
    const callers = sources.filter((file) => /\breloadAsync\(/.test(read(file)));
    expect(callers).toEqual([path.join('app', 'profile', 'settings.jsx')]);
  });

  it('the update service itself never restarts the app', () => {
    expect(read('services/appUpdates.js')).not.toMatch(/reloadAsync\(/);
  });
});
