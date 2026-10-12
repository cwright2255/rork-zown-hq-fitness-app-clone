// services/gpxShare.js
//
// Hands a GPX file (see lib/gpxExport.js) to the phone's share sheet, so it can
// be saved to Files, sent by AirDrop or mail, or opened in another hiking app.
// The file is written to the app's cache folder first. The native modules are
// loaded only when needed, and can be passed in, so a missing one is a plain
// "can't do that here" instead of a crash.

// require() inside a function, not a top-of-file import, so the modules are only
// read when someone exports a route (and a test can stand in for them).
function loadFileSystem() {
  try {
    return require('expo-file-system/legacy');
  } catch (e) {
    return null;
  }
}

function loadSharing() {
  try {
    const mod = require('expo-sharing');
    return mod && typeof mod.shareAsync === 'function' ? mod : (mod && mod.default) || null;
  } catch (e) {
    return null;
  }
}

/**
 * @param file  { filename, title, xml } from lib/gpxExport.js
 * @param deps  { fs, sharing } to use instead of the real modules (tests)
 * @returns {Promise<{ ok: true, uri: string } | { ok: false, reason: 'no-route' | 'unavailable' | 'write-failed' | 'share-failed' }>}
 */
export async function shareGpx(file, deps = {}) {
  if (!file || typeof file.xml !== 'string' || !file.xml || typeof file.filename !== 'string' || !file.filename) {
    return { ok: false, reason: 'no-route' };
  }
  const fs = deps.fs !== undefined ? deps.fs : loadFileSystem();
  const sharing = deps.sharing !== undefined ? deps.sharing : loadSharing();
  if (!fs || !fs.cacheDirectory || typeof fs.writeAsStringAsync !== 'function' || !sharing) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    if (!(await sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
  } catch (e) {
    return { ok: false, reason: 'unavailable' };
  }
  const uri = `${fs.cacheDirectory}${file.filename}`;
  try {
    await fs.writeAsStringAsync(uri, file.xml, { encoding: 'utf8' });
  } catch (e) {
    return { ok: false, reason: 'write-failed' };
  }
  try {
    await sharing.shareAsync(uri, {
      mimeType: 'application/gpx+xml',
      UTI: 'com.topografix.gpx',
      dialogTitle: file.title || 'Export GPX',
    });
  } catch (e) {
    return { ok: false, reason: 'share-failed' };
  }
  return { ok: true, uri };
}

/** What to tell the person when an export did not happen. */
export function gpxShareErrorText(reason) {
  switch (reason) {
    case 'no-route':
      return 'There is no route to export for this one.';
    case 'unavailable':
      return 'Sharing files is not available on this phone.';
    case 'write-failed':
      return 'Could not prepare the file. Check that the phone has free space and try again.';
    default:
      return 'Could not open the share sheet. Try again.';
  }
}
