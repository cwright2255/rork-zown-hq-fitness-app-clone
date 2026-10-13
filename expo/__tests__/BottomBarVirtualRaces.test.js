// The floating Home bar is hidden on the pages inside a race or a journey (app/_layout.jsx).
// _layout has no render test (it sets up the whole app), so this reads the real condition out of
// the file and runs it against paths.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.jsx'), 'utf8');
const match = source.match(/\{(!pathname\.startsWith\('\/auth\/'\)[^\n]*?) && <BottomNavigation \/>\}/);

// true when the bar would show on this path
const barShows = match ? new Function('pathname', `return !!(${match[1]});`) : null;

describe('Home bar on the virtual race and journey pages', () => {
  it('finds the condition in the layout', () => {
    expect(match).not.toBeNull();
  });

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
