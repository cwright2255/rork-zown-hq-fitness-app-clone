// Handing a GPX file to the phone's share sheet (services/gpxShare.js).

// The phone's own modules, replaced. What each one does is set per test on global.__gpx.
jest.mock('expo-file-system/legacy', () => {
  if (global.__gpx.fsMissing) throw new Error('Cannot find module');
  return global.__gpx.fs;
}, { virtual: true });

jest.mock('expo-sharing', () => {
  if (global.__gpx.sharingMissing) throw new Error('Cannot find module');
  return global.__gpx.sharing;
}, { virtual: true });

const FILE = { filename: 'Ridge-2026-10-09.gpx', title: 'Ridge', xml: '<gpx></gpx>' };

const makeFs = (over = {}) => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  ...over,
});
const makeSharing = (over = {}) => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
  ...over,
});

let shareGpx;
let gpxShareErrorText;

beforeEach(() => {
  global.__gpx = { fs: makeFs(), sharing: makeSharing(), fsMissing: false, sharingMissing: false };
  jest.resetModules();
  ({ shareGpx, gpxShareErrorText } = require('@/services/gpxShare'));
});

afterEach(() => {
  delete global.__gpx;
});

describe('shareGpx with the phone\'s modules passed in', () => {
  it('writes the file to the cache folder and opens the share sheet', async () => {
    const fs = makeFs();
    const sharing = makeSharing();
    const result = await shareGpx(FILE, { fs, sharing });
    expect(result).toEqual({ ok: true, uri: 'file:///cache/Ridge-2026-10-09.gpx' });
    expect(fs.writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/Ridge-2026-10-09.gpx', '<gpx></gpx>', { encoding: 'utf8' });
    expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(sharing.shareAsync).toHaveBeenCalledWith('file:///cache/Ridge-2026-10-09.gpx', {
      mimeType: 'application/gpx+xml',
      UTI: 'com.topografix.gpx',
      dialogTitle: 'Ridge',
    });
  });

  it('writes the file before it shares it', async () => {
    const order = [];
    const fs = makeFs({ writeAsStringAsync: jest.fn(async () => { order.push('write'); }) });
    const sharing = makeSharing({ shareAsync: jest.fn(async () => { order.push('share'); }) });
    await shareGpx(FILE, { fs, sharing });
    expect(order).toEqual(['write', 'share']);
  });

  it('titles the sheet "Export GPX" when the file has no title', async () => {
    const sharing = makeSharing();
    await shareGpx({ filename: 'a.gpx', xml: '<gpx></gpx>' }, { fs: makeFs(), sharing });
    expect(sharing.shareAsync.mock.calls[0][1].dialogTitle).toBe('Export GPX');
  });

  it('says there is no route when there is no file to share, and touches nothing', async () => {
    const fs = makeFs();
    const sharing = makeSharing();
    const bad = [null, undefined, {}, 'x', { filename: 'a.gpx' }, { xml: '<gpx/>' }, { filename: '', xml: '<gpx/>' },
      { filename: 'a.gpx', xml: '' }, { filename: 5, xml: '<gpx/>' }, { filename: 'a.gpx', xml: 5 }];
    for (const file of bad) {
      // eslint-disable-next-line no-await-in-loop
      expect(await shareGpx(file, { fs, sharing })).toEqual({ ok: false, reason: 'no-route' });
    }
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
    expect(sharing.isAvailableAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('says it is unavailable when the phone cannot share files, and writes nothing', async () => {
    const fs = makeFs();
    const sharing = makeSharing({ isAvailableAsync: jest.fn().mockResolvedValue(false) });
    expect(await shareGpx(FILE, { fs, sharing })).toEqual({ ok: false, reason: 'unavailable' });
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('says it is unavailable when asking about sharing fails', async () => {
    const sharing = makeSharing({ isAvailableAsync: jest.fn().mockRejectedValue(new Error('boom')) });
    expect(await shareGpx(FILE, { fs: makeFs(), sharing })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('says it is unavailable when a module is missing or has no cache folder', async () => {
    expect(await shareGpx(FILE, { fs: null, sharing: makeSharing() })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await shareGpx(FILE, { fs: makeFs(), sharing: null })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await shareGpx(FILE, { fs: makeFs({ cacheDirectory: null }), sharing: makeSharing() }))
      .toEqual({ ok: false, reason: 'unavailable' });
    expect(await shareGpx(FILE, { fs: makeFs({ cacheDirectory: '' }), sharing: makeSharing() }))
      .toEqual({ ok: false, reason: 'unavailable' });
    expect(await shareGpx(FILE, { fs: makeFs({ writeAsStringAsync: undefined }), sharing: makeSharing() }))
      .toEqual({ ok: false, reason: 'unavailable' });
  });

  it('says the file could not be written, and does not open the share sheet', async () => {
    const fs = makeFs({ writeAsStringAsync: jest.fn().mockRejectedValue(new Error('disk full')) });
    const sharing = makeSharing();
    expect(await shareGpx(FILE, { fs, sharing })).toEqual({ ok: false, reason: 'write-failed' });
    expect(sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('says the share sheet failed to open', async () => {
    const sharing = makeSharing({ shareAsync: jest.fn().mockRejectedValue(new Error('no activity')) });
    expect(await shareGpx(FILE, { fs: makeFs(), sharing })).toEqual({ ok: false, reason: 'share-failed' });
  });

  it('treats a share sheet closed without choosing as done', async () => {
    const sharing = makeSharing({ shareAsync: jest.fn().mockResolvedValue({ action: 'dismissed' }) });
    const result = await shareGpx(FILE, { fs: makeFs(), sharing });
    expect(result.ok).toBe(true);
  });
});

describe('shareGpx with the phone\'s own modules', () => {
  it('loads them and shares', async () => {
    const result = await shareGpx(FILE);
    expect(result).toEqual({ ok: true, uri: 'file:///cache/Ridge-2026-10-09.gpx' });
    expect(global.__gpx.fs.writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(global.__gpx.sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it('finds sharing on the default export of the module', async () => {
    const sharing = makeSharing();
    global.__gpx.sharing = { default: sharing };
    const result = await shareGpx(FILE);
    expect(result.ok).toBe(true);
    expect(sharing.shareAsync).toHaveBeenCalledTimes(1);
  });

  it('says it is unavailable, not a crash, when the file module is not in this build', async () => {
    global.__gpx.fsMissing = true;
    expect(await shareGpx(FILE)).toEqual({ ok: false, reason: 'unavailable' });
    expect(global.__gpx.sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('says it is unavailable, not a crash, when the sharing module is not in this build', async () => {
    global.__gpx.sharingMissing = true;
    expect(await shareGpx(FILE)).toEqual({ ok: false, reason: 'unavailable' });
    expect(global.__gpx.fs.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('uses the modules passed in rather than loading its own', async () => {
    const fs = makeFs({ cacheDirectory: 'file:///other/' });
    const sharing = makeSharing();
    const result = await shareGpx(FILE, { fs, sharing });
    expect(result.uri).toBe('file:///other/Ridge-2026-10-09.gpx');
    expect(global.__gpx.fs.writeAsStringAsync).not.toHaveBeenCalled();
    expect(global.__gpx.sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('gpxShareErrorText', () => {
  it('has a plain sentence for each reason', () => {
    expect(gpxShareErrorText('no-route')).toBe('There is no route to export for this one.');
    expect(gpxShareErrorText('unavailable')).toBe('Sharing files is not available on this phone.');
    expect(gpxShareErrorText('write-failed')).toBe('Could not prepare the file. Check that the phone has free space and try again.');
    expect(gpxShareErrorText('share-failed')).toBe('Could not open the share sheet. Try again.');
  });

  it('falls back to the share sheet message for anything else', () => {
    expect(gpxShareErrorText(undefined)).toBe('Could not open the share sheet. Try again.');
    expect(gpxShareErrorText('???')).toBe('Could not open the share sheet. Try again.');
  });
});
