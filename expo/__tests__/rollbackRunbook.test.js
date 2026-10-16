// docs/ROLLBACK.md is read on a bad day, by someone who does not have time to find out that a command was renamed or that the
// page describes a setup the app no longer has. This keeps the page and the things it relies on in step: the commands it
// names, the channel the publish workflow uses, the way the runtime version is chosen, and the files it points at.
const fs = require('fs');
const path = require('path');

const expoDir = path.join(__dirname, '..');
const repoDir = path.join(expoDir, '..');
const doc = fs.readFileSync(path.join(expoDir, 'docs', 'ROLLBACK.md'), 'utf8');
const appJson = JSON.parse(fs.readFileSync(path.join(expoDir, 'app.json'), 'utf8'));
const easJson = JSON.parse(fs.readFileSync(path.join(expoDir, 'eas.json'), 'utf8'));
const publishWorkflow = fs.readFileSync(path.join(repoDir, '.github', 'workflows', 'expo-publish.yml'), 'utf8');

describe('the rollback runbook', () => {
  it('names the commands that find an update and put it back', () => {
    for (const command of [
      'eas channel:view', 'eas update:list', 'eas update:view', 'eas update:republish', 'eas update:rollback',
      'eas update:roll-back-to-embedded',
    ]) {
      expect(doc).toContain(command);
    }
  });

  it('republishes a group by its ID, which is the only way eas-cli allows without questions', () => {
    expect(doc).toMatch(/eas update:republish --group <\w+>/);
  });

  it('looks at the channel the publish workflow publishes to, and at the one the production build reads', () => {
    const channel = publishWorkflow.match(/eas update --channel (\w+)/)[1];
    expect(doc).toContain(`eas channel:view ${channel}`);
    expect(doc).toContain(`--channel ${channel}`);
    expect(easJson.build.production.channel).toBe('production');
    expect(doc).toContain('eas channel:view production');
  });

  it('describes the way updates reach builds as the app is set up: by app version', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(doc).toContain('`appVersion` policy');
  });

  it('has a practice run with a checkbox for every step, and a way to see the result on the phone', () => {
    expect(doc).toContain('## Practice');
    const checks = doc.split('\n').filter((line) => line.startsWith('- [ ] '));
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(doc).toContain('DEVICE_CHECKS.md');
    expect(fs.existsSync(path.join(expoDir, 'docs', 'DEVICE_CHECKS.md'))).toBe(true);
  });

  it('says what it cannot undo, so nobody expects an update to fix a build, a function or the rules', () => {
    expect(doc).toContain('firebase deploy --only functions');
    expect(doc).toContain('firebase deploy --only firestore:rules');
  });

  it('is linked from the README, next to the note about how updates are published', () => {
    const readme = fs.readFileSync(path.join(repoDir, 'README.md'), 'utf8');
    expect(readme).toContain('expo/docs/ROLLBACK.md');
  });
});
