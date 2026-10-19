// When a workout is finished (app/workout/active.jsx, in two places: finishing early and finishing all the way), the
// achievements check is given the streak worked out from the person's workouts, runs and hikes (services/streakService.js).
// It used to be given user.streak, a counter nothing ever updated, so a streak achievement could never unlock. (The leaderboard
// used to be handed it too, by the phone; the leaderboard's XP and streak are the server's now, so the phone hands it nothing.)
// The screen is too big to render in a test, so this reads its source, the way signInLoadsHikes does for the sign-in code.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'workout', 'active.jsx'), 'utf8');
const count = (re) => (source.match(re) || []).length;

describe('finishing a workout', () => {
  it('imports the streak from the streak service', () => {
    expect(source).toContain("import { getActivityStreak } from '@/services/streakService';");
  });

  it('hands the achievements check the real streak, both ways of finishing', () => {
    expect(count(/checkAchievements\?\.\(\{/g)).toBe(2);
    expect(count(/streak: getActivityStreak\(\)\.current,/g)).toBe(2);
  });

  it('does not put a score on the leaderboard itself: the XP it files is what the server turns into one', () => {
    expect(source).not.toMatch(/publishMyXp/);
    expect(source).not.toMatch(/leaderboardVisibility/);
    expect(count(/addExpActivity\?\.\(\{/g)).toBe(2);
  });

  it('no longer reads the counter on the user record', () => {
    expect(source).not.toMatch(/user\??\.streak/);
  });

  it('works the streak out after the workout is saved, so it includes that workout', () => {
    const saved = source.match(/await addCompletedWorkout\([\s\S]*?checkAchievements\?\.\(\{[\s\S]*?\}, user\?\.uid\);/g) || [];
    expect(saved.length).toBe(2);
    for (const chunk of saved) {
      expect(chunk.indexOf('getActivityStreak().current')).toBeGreaterThan(chunk.indexOf('await addCompletedWorkout('));
    }
  });
});
