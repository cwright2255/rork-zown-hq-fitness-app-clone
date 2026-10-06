// lib/crashReporting.js
//
// Thin, best-effort wrapper around Firebase Crashlytics
// (@react-native-firebase/crashlytics). Every function here is safe to call
// no matter what: if the native module isn't in the installed binary (for
// example an older TestFlight build that predates it, since JS updates are
// delivered to every build on the same runtime version), loading it just
// fails quietly and every call becomes a no-op - reporting must never be
// the thing that crashes the app.
//
// Once the module loads, Crashlytics itself automatically reports native
// crashes, fatal JS errors, and unhandled promise rejections; this file
// adds context (who, and which screen) and a way to report caught errors.

let api = null;
let instance = null;
let tried = false;

function load() {
  if (tried) return instance !== null;
  tried = true;
  try {
    // eslint-disable-next-line global-require
    api = require('@react-native-firebase/crashlytics');
    instance = api.getCrashlytics();
  } catch (e) {
    api = null;
    instance = null;
  }
  return instance !== null;
}

function toError(err) {
  return err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
}

// Call once at startup. Loading the module is what installs Crashlytics'
// automatic crash handlers.
export function initCrashReporting() {
  load();
}

// Ties reports to the signed-in user's Firebase uid (an opaque id, no name
// or email) so you can tell whether one tester or everyone is affected.
export function setCrashUser(uid) {
  if (!uid || !load()) return;
  try {
    api.setUserId(instance, String(uid)).catch(() => {});
  } catch (e) {
    // best-effort
  }
}

// A short trail of what the user was doing, attached to the next report.
export function logBreadcrumb(message) {
  if (!load()) return;
  try {
    api.log(instance, String(message).slice(0, 200));
  } catch (e) {
    // best-effort
  }
}

// Report an error that was caught (so it didn't crash the app) but that
// you still want to see. `context` is a short label such as 'coach:send'.
export function reportError(err, context) {
  if (!load()) return;
  try {
    if (context) api.log(instance, `context: ${context}`);
    api.recordError(instance, toError(err));
  } catch (e) {
    // best-effort
  }
}

// For verifying the pipeline end to end from a real build.
export function sendTestReport() {
  reportError(new Error('Test error report from ZOWN HQ (non-fatal)'), 'manual-test');
  try {
    if (load()) api.sendUnsentReports(instance);
  } catch (e) {
    // best-effort
  }
}

export function forceTestCrash() {
  if (!load()) return;
  try {
    api.crash(instance);
  } catch (e) {
    // best-effort
  }
}

export function isCrashReportingAvailable() {
  return load();
}
