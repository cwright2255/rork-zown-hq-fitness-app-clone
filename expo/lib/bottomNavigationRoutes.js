// lib/bottomNavigationRoutes.js
//
// Where the floating bottom navigation (components/BottomNavigation.jsx) is hidden. app/_layout.jsx asks showsBottomNavigation(pathname)
// on every screen change; before this list the answer was one 1,230-character condition in the layout.
//
// To hide the bar on a new screen, add its path to the list that fits. __tests__/bottomNavigationRoutes.test.js holds this list to the
// condition it replaced, so a path that is moved from one list to another or dropped by mistake is caught.

/** Hidden on exactly these paths (the launch gate and the start screen). */
export const HIDDEN_ON = ['/', '/index', '/start'];

/** Hidden on these paths and on everything below them: '/messages' covers '/messages/abc', and also '/messages2' (it is a text prefix). */
export const HIDDEN_ON_PATHS_STARTING_WITH = [
  // Signing in and up
  '/auth/',
  // Body scan, messages, the Coach, the paywall, the food scanners and the Shop's product, cart and try-on pages
  '/body-scan',
  '/messages',
  '/coach',
  '/paywall',
  '/nutrition/scan',
  '/nutrition/barcode-scan',
  '/shop/product',
  '/shop/cart',
  '/shop/try-on',
  // Running, hiking, races and journeys
  '/running/hiking',
  '/running/run/',
  '/running/races/',
  '/running/journeys/',
  // Profile pages that open from a row in Settings or Profile
  '/profile/edit',
  '/profile/settings',
  '/profile/terms',
  '/profile/privacy-policy',
  '/profile/blocked',
  '/profile/licenses',
  '/profile/running-log',
  '/profile/workout-history',
  '/profile/calorie-history',
  '/profile/notifications',
  '/profile/help',
];

/** Hidden on any path that matches one of these (a rule that a plain "starts with" cannot say). */
export const HIDDEN_ON_PATTERNS = [
  // Every screen inside /workout (/workout/active, /workout/123), but not /workout itself.
  /^\/workout\/.+$/,
  // The running screens one level down (/running/active, /running/import, /running/abc), but not /running/program.
  /^\/running\/(?!program)[^/]+$/,
];

/** True when the bottom navigation is shown on this screen. */
export function showsBottomNavigation(pathname) {
  if (HIDDEN_ON.includes(pathname)) return false;
  if (HIDDEN_ON_PATHS_STARTING_WITH.some((start) => pathname.startsWith(start))) return false;
  if (HIDDEN_ON_PATTERNS.some((pattern) => pattern.test(pathname))) return false;
  return true;
}
