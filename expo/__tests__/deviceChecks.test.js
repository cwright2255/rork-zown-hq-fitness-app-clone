// docs/DEVICE_CHECKS.md is the list of what to look at on the phone after an update. A list that names screens that no
// longer exist stops being trusted, so this checks that every file it points at is still there and that the sections
// that matter are still in it.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(root, 'docs', 'DEVICE_CHECKS.md'), 'utf8');

describe('the phone checklist', () => {
  it('has the sections for each kind of update', () => {
    for (const heading of [
      'Every update', 'Your own day, in the evening', 'Eat goal and burn goal are separate',
      'Runs and hikes count everywhere', 'Streak and steps', 'The Coach', 'After changing a key or a Cloud Function',
    ]) {
      expect(doc).toContain(`## ${heading}`);
    }
  });

  it('says how to apply an update, so the first check is not run on the old version', () => {
    expect(doc).toMatch(/close the app completely and open it twice/i);
  });

  it('only points at files that exist', () => {
    const files = [...doc.matchAll(/`((?:app|components|lib|services|store|docs)\/[^`\s]+)`/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect({ file, exists: fs.existsSync(path.join(root, file)) }).toEqual({ file, exists: true });
  });

  it('has a checkbox for every check', () => {
    const checks = doc.split('\n').filter((line) => line.startsWith('- [ ] '));
    expect(checks.length).toBeGreaterThanOrEqual(15);
  });

  it('says where the streak calendar is, and Profile really links there', () => {
    expect(doc).toContain('Profile, then Streak Calendar');
    expect(doc).not.toMatch(/Not reachable from the app yet/);
    const profile = fs.readFileSync(path.join(root, 'app', 'profile.jsx'), 'utf8');
    expect(profile).toContain("label: 'Streak Calendar', route: '/profile/streak'");
    expect(fs.existsSync(path.join(root, 'app', 'profile', 'streak.jsx'))).toBe(true);
  });

  it('has the check that the old admin links do nothing', () => {
    expect(doc).toContain('zownhq://admin?cmd=logout');
    expect(doc).toContain('## Links into the app');
  });
});
