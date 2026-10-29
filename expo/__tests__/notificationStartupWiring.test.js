// The root layout starts notifications once, when the app opens: that registers the handler that shows a notification while the app is
// open (a one-minute cooking timer should show a banner with Zown in front), and starts following the Notifications switch. This reads
// the root layout's source because the layout itself needs the whole app around it to render.
const fs = require('fs');
const path = require('path');

const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.jsx'), 'utf8');
const inner = layout.slice(layout.indexOf('function RootLayoutInner()'));

describe('root layout and notifications', () => {
  it('gets startNotifications', () => {
    expect(layout).toMatch(/import \{ startNotifications \} from '@\/services\/notificationStartup';/);
  });

  it('calls it in an effect that runs once, when the app opens, not on every screen change', () => {
    expect(inner).toMatch(/useEffect\(\(\) => \{ startNotifications\(\); \}, \[\]\);/);
    expect(layout.match(/startNotifications\(\)/g)).toHaveLength(1);
  });

  it('is the only place that asks notificationService to register the handler, so it is registered once', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        if (['node_modules', '__tests__', '.expo', 'dist', 'ios', 'android'].includes(name)) continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(name)) files.push(full);
      }
    };
    walk(path.join(__dirname, '..'));
    const callers = files
      .filter((f) => /\.setupNotificationHandler\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'))
      .sort();
    expect(callers).toEqual(['services/notificationStartup.js']);
  });
});
