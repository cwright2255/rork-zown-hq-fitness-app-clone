// Report, Block and the Terms line only protect people if every place that shows other people's words has them. These fail when a screen
// loses its menu, stops leaving blocked people out, or when the Terms and Privacy Policy cannot be opened before an account exists.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('every screen that shows other people\'s words has the menu', () => {
  it.each([
    ['the Social feed', 'app/social.jsx'],
    ['the Community feed', 'app/community.jsx'],
    ['the message thread', 'app/messages/[id].jsx'],
  ])('%s opens the Report / Block sheet', (_, file) => {
    const source = read(file);
    expect(source).toMatch(/import ModerationSheet from '@\/components\/ModerationSheet'/);
    expect(source).toContain('<ModerationSheet');
  });

  it('the Social and Community feeds have one for comments as well as one for posts', () => {
    for (const file of ['app/social.jsx', 'app/community.jsx']) {
      const source = read(file);
      expect(source).toMatch(/commentTarget\(/);
      expect(source).toMatch(/postTarget\(/);
      expect((source.match(/<ModerationSheet/g) || []).length).toBe(2);
    }
  });

  it('the thread offers a message and the person', () => {
    const source = read('app/messages/[id].jsx');
    expect(source).toMatch(/messageTarget\(/);
    expect(source).toMatch(/personTarget\(/);
  });
});

describe('every list of other people leaves blocked people out', () => {
  it.each([
    'app/social.jsx',
    'app/community.jsx',
    'app/messages.jsx',
  ])('%s uses withoutBlocked and follows the block list', (file) => {
    const source = read(file);
    expect(source).toMatch(/withoutBlocked\(/);
    expect(source).toMatch(/useBlockStore/);
    expect(source).toMatch(/subscribeBlocks/);
  });

  it('the Social and Community feeds filter both posts and comments', () => {
    for (const file of ['app/social.jsx', 'app/community.jsx']) {
      expect((read(file).match(/withoutBlocked\(/g) || []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('the Messages list filters the conversations and the New Message picker', () => {
    expect((read('app/messages.jsx').match(/withoutBlocked\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('the Blocked people list', () => {
  it('is opened from Settings', () => {
    expect(read('app/profile/settings.jsx')).toContain("router.push('/profile/blocked')");
    expect(fs.existsSync(path.join(ROOT, 'app/profile/blocked.jsx'))).toBe(true);
  });

  it('has no tab bar, like the rest of Settings', () => {
    expect(require('../lib/bottomNavigationRoutes').showsBottomNavigation('/profile/blocked')).toBe(false);
  });

  it('is emptied when the person logs out, so the next person to sign in on the phone does not inherit it', () => {
    // logOut.test.js resets every store in the list and checks the list against the stores that exist; this is that this one is in it.
    expect(read('lib/logOut.js')).toMatch(/blockStore:\s*useBlockStore/);
  });
});

describe('the Terms step', () => {
  it('opens the two documents from sign-up, so they are screens that exist', () => {
    const register = read('app/auth/register.jsx');
    expect(register).toContain("router.push('/profile/terms')");
    expect(register).toContain("router.push('/profile/privacy-policy')");
    expect(fs.existsSync(path.join(ROOT, 'app/profile/terms.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'app/profile/privacy-policy.jsx'))).toBe(true);
  });

  it('lets both documents stay open before the person is onboarded: the redirect to onboarding would otherwise send them away', () => {
    const layout = read('app/_layout.jsx');
    expect(layout).toMatch(/pathname === '\/spotify-callback'\s*\|\|\s*pathname === '\/profile\/terms'\s*\|\|\s*pathname === '\/profile\/privacy-policy'\) return;/);
  });

  it('uses the shared no-tolerance line, and the Terms say the same', () => {
    expect(read('app/auth/register.jsx')).toMatch(/\{NO_TOLERANCE_LINE\}/);
    expect(read('app/profile/terms.jsx')).toMatch(/no tolerance for objectionable content or abusive users/);
  });
});
