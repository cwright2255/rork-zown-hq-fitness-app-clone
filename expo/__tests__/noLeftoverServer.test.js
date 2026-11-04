// Build 13 deleted backend/ (a Hono and tRPC server that nothing in the app called) and the packages only it used. This keeps
// them gone: the folder, the packages in package.json and in bun.lock (CI installs with --frozen-lockfile, so the two must agree),
// and any import of them in the app's own code.
const fs = require('fs');
const path = require('path');

const expoDir = path.join(__dirname, '..');
const PACKAGES = ['hono', '@hono/trpc-server', '@trpc/server', '@trpc/client', '@trpc/react-query', 'superjson'];
const pkg = JSON.parse(fs.readFileSync(path.join(expoDir, 'package.json'), 'utf8'));
const lock = fs.readFileSync(path.join(expoDir, 'bun.lock'), 'utf8');

const SKIP = new Set(['node_modules', '__tests__', 'ios', 'android', 'dist', 'coverage']);
function sourceFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(jsx?|tsx?)$/.test(name)) out.push(full);
  }
  return out;
}

describe('the leftover server', () => {
  it('is gone', () => {
    expect(fs.existsSync(path.join(expoDir, 'backend'))).toBe(false);
  });

  it.each(PACKAGES)('has no %s in package.json or in bun.lock', (name) => {
    const declared = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies };
    expect(Object.keys(declared)).not.toContain(name);
    expect(lock).not.toContain(`"${name}"`);
  });

  it('is imported by nothing in the app or the cloud functions', () => {
    const importOf = (name) => new RegExp(`(?:from\\s+|require\\()['"]${name.replace(/[/@]/g, '\\$&')}(?:/[^'"]*)?['"]`);
    const offenders = [];
    for (const file of sourceFiles(expoDir)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const name of PACKAGES) if (importOf(name).test(text)) offenders.push(`${path.relative(expoDir, file)} imports ${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it('left zod and react-query in place, which the Rork toolkit in the Metro config needs as peers', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(expect.arrayContaining(['zod', '@tanstack/react-query']));
  });

  it('has a bun.lock whose top-level packages are exactly the ones package.json lists', () => {
    const workspace = lock.slice(lock.indexOf('"workspaces"'), lock.indexOf('"packages"'));
    const section = (key) => {
      const start = workspace.indexOf(`"${key}": {`);
      if (start < 0) return [];
      const end = workspace.indexOf('}', start);
      return [...workspace.slice(start, end).matchAll(/^\s+"([^"]+)": "[^"]*",?$/gm)].map((m) => m[1]);
    };
    expect(section('dependencies').sort()).toEqual(Object.keys(pkg.dependencies).sort());
    expect(section('devDependencies').sort()).toEqual(Object.keys(pkg.devDependencies || {}).sort());
  });
});
