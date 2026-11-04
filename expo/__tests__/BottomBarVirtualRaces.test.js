// The floating Home bar is hidden on the pages inside a race or a journey (lib/bottomNavigationRoutes.js, asked by app/_layout.jsx).
// _layout has no render test (it sets up the whole app), so this runs the list against paths.
const { showsBottomNavigation } = require('../lib/bottomNavigationRoutes');

// true when the bar would show on this path
const barShows = showsBottomNavigation;

describe('Home bar on the virtual race and journey pages', () => {
  it('is hidden on a race page and on a journey page', () => {
    expect(barShows('/running/races/local-5k')).toBe(false);
    expect(barShows('/running/races/worldwide-10k')).toBe(false);
    expect(barShows('/running/journeys/inca-trail')).toBe(false);
    expect(barShows('/running/journeys/camino-frances')).toBe(false);
  });

  it('stays hidden on the View All page', () => {
    expect(barShows('/running/races')).toBe(false);
  });

  it('is still shown on the other running pages and the main pages', () => {
    expect(barShows('/running/program')).toBe(true);
    expect(barShows('/running/program/couch-to-5k')).toBe(true);
    expect(barShows('/running/week/1')).toBe(true);
    expect(barShows('/profile')).toBe(true);
    expect(barShows('/home')).toBe(true);
  });

  it('is still hidden where it was before', () => {
    expect(barShows('/running/active')).toBe(false);
    expect(barShows('/running/run/abc')).toBe(false);
    expect(barShows('/running/hiking/index')).toBe(false);
    expect(barShows('/workout/complete')).toBe(false);
    expect(barShows('/start')).toBe(false);
  });
});
