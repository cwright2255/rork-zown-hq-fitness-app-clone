// The launch splash replaced three older ones (a black glitch screen over the whole app, a Lottie splash in app/index.jsx, and a
// white overlay inside the login screen). This fails if one of them comes back, or if the new one is taken off the login screen.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const sourceFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') sourceFiles(rel, out);
    } else if (/\.(js|jsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
};

describe('the launch splash is the only splash', () => {
  it('has no black glitch screen over the whole app', () => {
    const layout = read('app/_layout.jsx');
    expect(layout).not.toContain('SplashAnimation');
    expect(layout).not.toContain('splashVisible');
  });

  it('has no Lottie splash: the component is gone and nothing imports it', () => {
    expect(fs.existsSync(path.join(ROOT, 'components/SplashScreen.jsx'))).toBe(false);
    const importers = ['app', 'components', 'lib', 'services', 'store', 'src']
      .filter((d) => fs.existsSync(path.join(ROOT, d)))
      .flatMap((d) => sourceFiles(d))
      .filter((f) => /components\/SplashScreen['"]/.test(read(f)));
    expect(importers).toEqual([]);
    expect(read('app/index.jsx')).not.toMatch(/lottie/i);
  });

  it('has no white overlay of its own inside the login screen, and puts the launch splash there instead', () => {
    const login = read('app/auth/login.jsx');
    expect(login).not.toContain('splashOverlay');
    expect(login).not.toContain('splashLogo');
    expect(login).not.toContain('zown-logo-512');
    expect(login).toContain("import ZownGlitchSplash from '@/components/ZownGlitchSplash'");
    expect(login).toMatch(/<ZownGlitchSplash\s+onFinish=/);
  });

  it('plays it from the login screen only once per opening of the app', () => {
    const login = read('app/auth/login.jsx');
    expect(login).toContain('hasLaunchSplashPlayed()');
    expect(login).toContain('markLaunchSplashPlayed()');
  });

  it('sends someone who is signed in straight to Home from app/index.jsx', () => {
    const index = read('app/index.jsx');
    expect(index).toContain("<Redirect href={isOnboarded ? '/hq' : '/start'} />");
    expect(index).not.toContain('splashDone');
  });

  it('uses the real wordmark file', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets/branding/zown-wordmark.png'))).toBe(true);
    expect(read('components/ZownGlitchSplash.jsx')).toContain("require('@/assets/branding/zown-wordmark.png')");
  });
});
