// The command the safety set is run with (cd expo/functions && node safety/run.js), run for real under node against a fake `openai`
// package and a fake `firebase` program, in a copy of the folders it needs. This is what proves the glue works: that scope.js
// loads on its own, the key is found without being printed, the options are read, and the exit code says whether the set passed.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { SAFETY_CASES } from '../functions/safety/cases';

const FUNCTIONS = path.join(__dirname, '..', 'functions');
const KEY = 'sk-test-key-0123456789';
const FINGERPRINT = require('../functions/safety/fingerprint').EXPECTED_FINGERPRINT;

// A stand-in for the openai package. It finds the case from the last thing the person said and answers as a perfect check and model
// would; FAKE_LEAK=<id> makes both slip on that case, FAKE_ERROR=<id> makes OpenAI fail on it.
const FAKE_OPENAI = `
import { appendFileSync } from 'node:fs';
import { SAFETY_CASES } from '../../safety/cases.js';
const lastText = (messages) => messages[messages.length - 1];
export default class OpenAI {
  constructor(options) {
    if (options.apiKey !== ${JSON.stringify(KEY)}) throw new Error('wrong key');
    this.chat = { completions: { create: async (args) => {
      const gate = String(args.messages[0].content).startsWith('You are the topic check');
      const last = gate ? JSON.parse(args.messages[1].content).pop().text : lastText(args.messages).content;
      const found = SAFETY_CASES.find((c) => c.messages[c.messages.length - 1].content === last);
      if (!found) throw new Error('no such case: ' + last);
      if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, JSON.stringify({ id: found.id, gate, model: args.model }) + '\\n');
      if (process.env.FAKE_ERROR === found.id) throw new Error('rate limited');
      const slip = process.env.FAKE_LEAK === found.id;
      const allow = (found.expect === 'allow') !== slip;
      if (gate) return { choices: [{ message: { content: JSON.stringify({ allowed: allow }) } }] };
      const refusal = /exactly this sentence: "([^"]+)"/.exec(args.messages[0].content)[1];
      return { choices: [{ message: { content: allow ? 'Here is some help.' : refusal } }] };
    } } };
  }
}
`;
const FAKE_FIREBASE = (output) => `#!/bin/sh\nif [ "$1" = "functions:secrets:access" ] && [ "$2" = "OPENAI_API_KEY" ] && [ -d functions ]; then\ncat <<'OUT'\n${output}\nOUT\nexit 0\nfi\nexit 1\n`;

let root;
const trees = [];

// A fresh copy of the folders run.js needs, with the fake openai package: <tree>/functions/{safety,src,node_modules/openai} and <tree>/bin/firebase.
function makeTree({ openai = true } = {}) {
  const dir = fs.mkdtempSync(path.join(root, 'tree-'));
  fs.mkdirSync(path.join(dir, 'functions', 'src'), { recursive: true });
  fs.cpSync(path.join(FUNCTIONS, 'safety'), path.join(dir, 'functions', 'safety'), { recursive: true });
  fs.copyFileSync(path.join(FUNCTIONS, 'src', 'scope.js'), path.join(dir, 'functions', 'src', 'scope.js'));
  if (openai) {
    const pkg = path.join(dir, 'functions', 'node_modules', 'openai');
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'openai', type: 'module', main: 'index.js' }));
    fs.writeFileSync(path.join(pkg, 'index.js'), FAKE_OPENAI);
  }
  trees.push(dir);
  return dir;
}

const withFirebase = (dir, output) => {
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bin', 'firebase'), FAKE_FIREBASE(output), { mode: 0o755 });
};

const run = (dir, args = [], env = {}) => {
  const result = spawnSync(process.execPath, ['safety/run.js', ...args], {
    cwd: path.join(dir, 'functions'),
    encoding: 'utf8',
    env: { PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}`, HOME: dir, ...env },
  });
  return { status: result.status, out: result.stdout, err: result.stderr, both: `${result.stdout}\n${result.stderr}` };
};

beforeAll(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'zown-safety-test-')); });
afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('node safety/run.js', () => {
  it('passes, exits 0 and prints the table when every case is right', () => {
    const dir = makeTree();
    const r = run(dir, [], { OPENAI_API_KEY: KEY });
    expect(r.err).toBe('');
    expect(r.status).toBe(0);
    expect(r.out).toContain(`Running ${SAFETY_CASES.length} cases x 1 (main model gpt-4o, topic check gpt-4o-mini)`);
    expect(r.out).toContain(`RESULT: PASSED - all ${SAFETY_CASES.length} cases are right for what the person sees.`);
    expect(r.out).toContain(`Topic check alone: ${SAFETY_CASES.length} of ${SAFETY_CASES.length} right`);
    for (const c of SAFETY_CASES) expect(r.out).toContain(c.id);
    expect(r.out).toContain(`Tested prompts and models: ${FINGERPRINT}`);
    expect(r.out).not.toContain('recorded fingerprint');
  });

  it('exits 1 and names the case when something would be answered that should be refused', () => {
    const r = run(makeTree(), [], { OPENAI_API_KEY: KEY, FAKE_LEAK: 'out-stocks' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('RESULT: FAILED');
    expect(r.out).toContain('leaks (answered, should refuse): out-stocks');
    expect(r.out).toMatch(/out-stocks\s+out-of-scope\s+refuse\s+MISS\s+MISS\s+MISS/);
    expect(r.out).toContain('Here is some help.');
  });

  it('exits 1 and names the case when something would be refused that should be answered', () => {
    const r = run(makeTree(), [], { OPENAI_API_KEY: KEY, FAKE_LEAK: 'in-protein' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('over-blocks (refused, should answer): in-protein');
  });

  it('reports an OpenAI failure on a case as an error and exits 1', () => {
    const r = run(makeTree(), [], { OPENAI_API_KEY: KEY, FAKE_ERROR: 'in-recipe' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('OpenAI errors: in-recipe');
    expect(r.out).toContain('error: rate limited');
  });

  it('runs one category with --category', () => {
    const r = run(makeTree(), ['--category=injection'], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(0);
    const injection = SAFETY_CASES.filter((c) => c.category === 'injection');
    expect(r.out).toContain(`Running ${injection.length} cases x 1`);
    expect(r.out).toContain('inj-roleplay');
    expect(r.out).not.toContain('in-protein');
  });

  it('runs every case that many times with --repeat', () => {
    const dir = makeTree();
    const log = path.join(dir, 'calls.log');
    const r = run(dir, ['--repeat=2', '--category=out-of-scope'], { OPENAI_API_KEY: KEY, FAKE_LOG: log });
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/Running 11 cases x 2/);
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(calls).toHaveLength(11 * 2 * 2); // each run asks the check and the main model
    expect(calls.filter((c) => c.id === 'out-stocks')).toHaveLength(4);
  });

  it('asks the check and the main model with the models it should, and the main model --model names', () => {
    const dir = makeTree();
    const log = path.join(dir, 'calls.log');
    expect(run(dir, ['--category=out-of-scope'], { OPENAI_API_KEY: KEY, FAKE_LOG: log }).status).toBe(0);
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(new Set(calls.filter((c) => c.gate).map((c) => c.model))).toEqual(new Set(['gpt-4o-mini']));
    expect(new Set(calls.filter((c) => !c.gate).map((c) => c.model))).toEqual(new Set(['gpt-4o']));

    const other = makeTree();
    const otherLog = path.join(other, 'calls.log');
    const r = run(other, ['--category=out-of-scope', '--model=gpt-4o-mini'], { OPENAI_API_KEY: KEY, FAKE_LOG: otherLog });
    expect(r.out).toContain('main model gpt-4o-mini');
    const seen = fs.readFileSync(otherLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(new Set(seen.filter((c) => !c.gate).map((c) => c.model))).toEqual(new Set(['gpt-4o-mini']));
  });

  it('gives a different code for what was tested when the main model is a different one', () => {
    const r = run(makeTree(), ['--category=out-of-scope', '--model=gpt-4o-mini'], { OPENAI_API_KEY: KEY });
    const code = /Tested prompts and models: ([0-9a-f]{12})/.exec(r.out)[1];
    expect(code).not.toBe(FINGERPRINT);
    expect(r.out).toContain(`this run tested ${code}`);
  });

  it('shows every reply with --verbose', () => {
    const r = run(makeTree(), ['--verbose', '--category=out-of-scope'], { OPENAI_API_KEY: KEY });
    expect(r.out).toContain('gate no; main: "I can only help with fitness, health, nutrition and using ZOWN HQ.');
  });

  it('saves the full results with --json', () => {
    const dir = makeTree();
    const r = run(dir, ['--json=results.json', '--category=out-of-scope'], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(0);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'functions', 'results.json'), 'utf8'));
    expect(saved.fingerprint).toBe(FINGERPRINT);
    expect(saved.summary.total).toBe(11);
    expect(saved.summary.layers.pipeline.right).toBe(11);
    expect(saved.results).toHaveLength(11);
    expect(JSON.stringify(saved)).not.toContain(KEY);
  });

  it('reads the key from the Firebase secret when OPENAI_API_KEY is not set, and never prints it', () => {
    const dir = makeTree();
    withFirebase(dir, KEY);
    const r = run(dir, ['--category=out-of-scope']);
    expect(r.status).toBe(0);
    expect(r.both).not.toContain(KEY);
  });

  it('ignores spaces after the key that the Firebase program prints', () => {
    const dir = makeTree();
    withFirebase(dir, `${KEY}   `);
    expect(run(dir, ['--category=out-of-scope']).status).toBe(0);
  });

  it('takes the last line when the Firebase program prints something before the key', () => {
    const dir = makeTree();
    withFirebase(dir, `Update available\n${KEY}`);
    expect(run(dir, ['--category=out-of-scope']).status).toBe(0);
  });

  it('ignores spaces and a line break around the key in OPENAI_API_KEY', () => {
    const r = run(makeTree(), ['--category=out-of-scope'], { OPENAI_API_KEY: `  ${KEY}\n` });
    expect(r.status).toBe(0);
  });

  it('asks Firebase from the app folder, where the project is set', () => {
    const dir = makeTree();
    withFirebase(dir, KEY);
    expect(run(dir, ['--category=out-of-scope']).status).toBe(0);
  });

  it('never prints the key, even when it is set in the environment and a case fails', () => {
    const r = run(makeTree(), [], { OPENAI_API_KEY: KEY, FAKE_ERROR: 'in-recipe' });
    expect(r.both).not.toContain(KEY);
  });

  it('exits 2 with a plain message when there is no key', () => {
    const dir = makeTree();
    withFirebase(dir, 'not a key');
    const r = run(dir, []);
    expect(r.status).toBe(2);
    expect(r.err).toContain('Could not run the safety set: Could not find the OpenAI key.');
    expect(r.out).toBe('');
  });

  it('exits 2 when the Firebase program is not there', () => {
    const r = run(makeTree(), [], { PATH: '/nonexistent' });
    expect(r.status).toBe(2);
    expect(r.err).toContain('Could not find the OpenAI key.');
  });

  it('exits 2 and says to npm install when the openai package is missing', () => {
    const r = run(makeTree({ openai: false }), [], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(2);
    expect(r.err).toContain('The openai package is missing. Run: cd expo/functions && npm install');
  });

  it('exits 2 for an option it does not know, before doing anything', () => {
    const r = run(makeTree(), ['--bogus'], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(2);
    expect(r.err).toContain('Unknown option: --bogus');
    expect(r.out).toBe('');
  });

  it('exits 2 for a category with no cases', () => {
    const r = run(makeTree(), ['--category=nonsense'], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(2);
    expect(r.err).toContain('No cases in the category "nonsense".');
  });

  it('exits 2 when scope.js has changed in a way it cannot load on its own', () => {
    const dir = makeTree();
    const file = path.join(dir, 'functions', 'src', 'scope.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace("from 'firebase-functions/v2/https'", "from 'firebase-functions/v2/other'"));
    const r = run(dir, [], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(2);
    expect(r.err).toContain('no longer starts as run.js expects');
  });

  it('says so when the prompts or models are not the ones recorded in the app', () => {
    const dir = makeTree();
    const file = path.join(dir, 'functions', 'safety', 'fingerprint.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(FINGERPRINT, 'aaaaaaaaaaaa'));
    const r = run(dir, ['--category=out-of-scope'], { OPENAI_API_KEY: KEY });
    expect(r.out).toContain(`Note: the app's recorded fingerprint is aaaaaaaaaaaa; this run tested ${FINGERPRINT}.`);
  });

  it('says nothing about a recorded fingerprint when none is recorded', () => {
    const dir = makeTree();
    const file = path.join(dir, 'functions', 'safety', 'fingerprint.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(FINGERPRINT, ''));
    const r = run(dir, ['--category=out-of-scope'], { OPENAI_API_KEY: KEY });
    expect(r.status).toBe(0);
    expect(r.out).not.toContain('recorded fingerprint');
  });

  it('leaves no temporary copy of scope.js behind', () => {
    const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('zown-safety-') && !n.startsWith('zown-safety-test-'));
    run(makeTree(), ['--category=out-of-scope'], { OPENAI_API_KEY: KEY });
    const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('zown-safety-') && !n.startsWith('zown-safety-test-'));
    expect(after.sort()).toEqual(before.sort());
  });
});
