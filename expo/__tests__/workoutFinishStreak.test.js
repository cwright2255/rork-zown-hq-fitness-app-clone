// When a workout is finished (app/workout/active.jsx, in two places: finishing early and finishing all the way), the phone saves the
// workout and files its XP claim, and that is all. Which achievements and badges the workout earns, the streak ones included, is the
// server's to decide (functions/src/unlocks.js, from the saved workouts and the XP ledger), so the screen no longer works out a streak
// to hand to an achievements check: there is no check on the phone. (It used to be given user.streak, a counter nothing ever updated,
// and later the streak worked out from the person's workouts, runs and hikes. The leaderboard's XP and streak are the server's too.)
// The screen is too big to render in a test, so this reads its source, the way signInLoadsHikes does for the sign-in code.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'workout', 'active.jsx'), 'utf8');
const count = (re) => (source.match(re) || []).length;

describe('finishing a workout', () => {
  it('saves the workout in both ways of finishing', () => {
    expect(count(/await addCompletedWorkout\(/g)).toBe(2);
  });

  it('does not decide achievements or badges itself: no achievement or badge store, no unlock call, no streak handed over', () => {
    expect(source).not.toMatch(/achievementStore|useAchievementStore|checkAchievements/);
    expect(source).not.toMatch(/badgeStore|useBadgeStore|unlockBadge/);
    expect(source).not.toMatch(/getActivityStreak|streakService/);
  });

  it('does not put a score on the leaderboard itself: the XP it files is what the server turns into one', () => {
    expect(source).not.toMatch(/publishMyXp/);
    expect(source).not.toMatch(/leaderboardVisibility/);
    expect(count(/addExpActivity\?\.\(\{/g)).toBe(2);
  });

  it('no longer reads the counter on the user record', () => {
    expect(source).not.toMatch(/user\??\.streak/);
  });

  it('files the XP claim after the workout is saved, in both ways of finishing', () => {
    const saved = source.match(/await addCompletedWorkout\([\s\S]*?addExpActivity\?\.\(\{/g) || [];
    expect(saved.length).toBe(2);
  });
});
