// When someone signs in, the root layout loads their saved data so every screen starts with it. Hikes were left out,
// so a hike only showed up in the screens that happened to open the hike list first. This reads the root layout's
// source because the layout itself needs the whole app around it to render.
const fs = require('fs');
const path = require('path');

const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.jsx'), 'utf8');

describe('root layout sign-in loading', () => {
  const afterSignIn = layout.slice(layout.indexOf('onAuthStateChanged(auth'));
  const loadBlock = afterSignIn.slice(afterSignIn.indexOf('Promise.all(['), afterSignIn.indexOf(']);'));

  it('finds the list of things loaded at sign-in', () => {
    expect(loadBlock).toContain('loadWorkouts(uid)');
    expect(loadBlock).toContain('loadRuns(uid)');
  });

  it('loads the saved hikes there too, beside the workouts and runs', () => {
    expect(loadBlock).toContain('loadCompletedHikes(uid)');
  });

  it('gets that loader from the hiking store', () => {
    expect(layout).toMatch(/import \{ useHikingStore \} from '@\/store\/hikingStore';/);
    expect(layout).toMatch(/const loadCompletedHikes = useHikingStore\(\(s\) => s\.loadCompletedHikes\);/);
  });
});
