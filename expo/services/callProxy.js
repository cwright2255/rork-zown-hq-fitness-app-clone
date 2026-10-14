// services/callProxy.js
//
// Calls one of the app's cloud functions and gives back what it answered. The proxy
// functions in functions/src/index.js (trail search, trail routes and photos, muscle
// diagrams) hold the keys for those services, so the app asks them instead of holding a
// key itself. A failure is thrown: each caller decides what to show when a request fails.
//
// firebase/functions is loaded when first needed, as the other services that call
// functions do. require, not import(): the same lazy load, and it can be run under Jest.
export async function callProxy(name, data) {
  const { httpsCallable } = require('firebase/functions');
  const { functions } = require('../src/config/firebase');
  const result = await httpsCallable(functions, name)(data);
  return result.data;
}
