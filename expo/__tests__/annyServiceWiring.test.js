// The 3D body mesh service (../anny-service) asks for a Firebase sign-in token before it makes a mesh. Python is not run by CI, so this
// reads what it can from the files: the check is attached to the mesh route and not to the health check, the file that holds it is
// copied into the image, its one new package is pinned, and it is checking tokens for the same Firebase project as the app.
// What the check itself does is tested in anny-service/test_token_guard.py (run from that folder with pytest).

const fs = require('fs');
const path = require('path');

const SERVICE = path.join(__dirname, '..', '..', 'anny-service');
const read = (name) => fs.readFileSync(path.join(SERVICE, name), 'utf8');
const expoRead = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const main = read('main.py');
const dockerfile = read('Dockerfile');
const requirements = read('requirements.txt');
const guard = read('token_guard.py');
// The README wraps its lines, so a sentence is looked for with its line breaks turned into spaces.
const readme = read('README.md').replace(/\s+/g, ' ');

// The line that declares a route and the line that opens the function under it.
const routeBlock = (decorator) => {
  const start = main.indexOf(decorator);
  expect(start).toBeGreaterThanOrEqual(0);
  return main.slice(start, main.indexOf('\ndef ', start));
};

describe('the mesh service asks who is calling', () => {
  it('imports the check from token_guard', () => {
    expect(main).toMatch(/^from token_guard import require_signed_in$/m);
    expect(main).toMatch(/^from fastapi import .*\bDepends\b/m);
  });

  it('puts the check on the mesh route, ahead of the work', () => {
    expect(routeBlock('@app.post("/generate-mesh"')).toContain('dependencies=[Depends(require_signed_in)]');
  });

  it('leaves the health check open, so Cloud Run can see the service is up', () => {
    const health = routeBlock('@app.get("/health"');
    expect(health).not.toContain('Depends');
    expect(health).not.toContain('require_signed_in');
  });

  it('has no other route that does work: the mesh route and the health check are the only two it declares', () => {
    const routes = main.match(/^@app\.(get|post|put|patch|delete)\(/gm) || [];
    expect(routes).toHaveLength(2);
  });
});

describe('the image carries the check', () => {
  const localModules = () => {
    const names = [...main.matchAll(/^(?:from|import)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
    return [...new Set(names)].filter((name) => fs.existsSync(path.join(SERVICE, `${name}.py`)));
  };
  const copied = () => dockerfile.split('\n').filter((line) => /^\s*COPY\b/i.test(line)).join(' ');

  it('finds token_guard among the files main.py imports from this folder', () => {
    expect(localModules()).toContain('token_guard');
  });

  it('copies every file main.py imports from this folder into the image (a file left out is missing when the service starts)', () => {
    for (const name of localModules()) {
      expect(copied()).toContain(`${name}.py`);
    }
  });

  it('still copies main.py and the requirements', () => {
    expect(copied()).toContain('main.py');
    expect(copied()).toContain('requirements.txt');
  });
});

describe('what the check needs', () => {
  it('pins the one package it uses to read Google-signed tokens', () => {
    expect(requirements).toMatch(/^google-auth==\d+\.\d+\.\d+$/m);
  });

  it('imports nothing heavy, so it can be tested without torch or Anny', () => {
    expect(guard).not.toMatch(/^\s*(import|from)\s+(torch|trimesh|anny)\b/m);
  });

  it('checks tokens for the same Firebase project the app signs people in with', () => {
    const production = JSON.parse(expoRead('eas.json')).build.production.env;
    const projectId = /os\.environ\.get\("FIREBASE_PROJECT_ID",\s*"([^"]+)"\)/.exec(guard);
    expect(projectId).not.toBeNull();
    expect(projectId[1]).toBe(production.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  });

  it('is the app\'s own mesh service that the app calls', () => {
    const app = expoRead('lib/loadScanMesh.js');
    expect(app).toContain('https://anny-mesh-service-431690627943.us-central1.run.app/generate-mesh');
    expect(app).toMatch(/import \{ signInHeader \} from '@\/lib\/signInHeader';/);
  });
});

describe('the README says what is true now', () => {
  it('explains that the service checks the Firebase sign-in token itself', () => {
    expect(readme).toContain('token_guard.py');
    expect(readme).toMatch(/Firebase sign-in token/);
  });

  it('keeps --allow-unauthenticated, with the reason, and no longer promises to tighten it later', () => {
    expect(readme).toContain('--allow-unauthenticated');
    expect(readme).not.toMatch(/no auth wiring on the app side yet/);
    expect(readme).not.toMatch(/tighten this before any real user traffic/);
  });

  it('still carries the cap on running copies in the deploy command', () => {
    expect(readme).toMatch(/--max-instances 3/);
  });
});
