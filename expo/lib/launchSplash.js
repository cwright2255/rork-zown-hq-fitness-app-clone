// The launch splash (components/ZownGlitchSplash.jsx) plays once each time the app is opened, on the login screen, for
// someone who is not signed in. This remembers that it has played, so the login screen does not play it again when it is
// reached later in the same session (after signing out, say). Opening the app again starts a new session, and it plays again.
//
// A signed-in person never reaches the login screen on launch (app/index.jsx sends them straight to Home), so they never see it.

let played = false;

export function hasLaunchSplashPlayed() {
  return played;
}

export function markLaunchSplashPlayed() {
  played = true;
}

/** For tests only: act as if the app had just been opened. */
export function resetLaunchSplashForTests() {
  played = false;
}
