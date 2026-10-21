// functions/safety/run.js
//
// Runs the safety set (cases.js) against the real OpenAI models and prints how the topic check, the main model and the two together
// did. Run it from the functions folder before changing the topic check, the scope rule or a model, and again after:
//
//   cd expo/functions && npm install && node safety/run.js
//
// Options: --verbose (show every reply), --repeat=3 (run each case 3 times; a case is right only if every run is),
//          --category=injection (one category), --model=gpt-4o (the main model), --json=results.json (save the full results).
// The key is read from OPENAI_API_KEY if that is set, otherwise from the Firebase secret of the same name. It is never printed.
// Exit code 0 = every case is right for what the person sees, 1 = at least one is not, 2 = it could not run.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SAFETY_CASES, COACH_SYSTEM } from './cases.js';
import { runSafetySet, formatReport, summarize, parseArgs, standaloneScopeSource } from './check.js';
import { safetyFingerprint, EXPECTED_FINGERPRINT } from './fingerprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(here, '..');
const expoDir = join(functionsDir, '..');

async function loadScope() {
  const source = standaloneScopeSource(readFileSync(join(functionsDir, 'src', 'scope.js'), 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'zown-safety-'));
  try {
    const file = join(dir, 'scope.mjs');
    writeFileSync(file, source);
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readKey() {
  const fromEnv = (process.env.OPENAI_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const out = execFileSync('firebase', ['functions:secrets:access', 'OPENAI_API_KEY'], { cwd: expoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const last = out.split('\n').map((line) => line.trim()).filter(Boolean).pop() || '';
    if (last.startsWith('sk-')) return last;
  } catch {
    // fall through to the message below
  }
  throw new Error('Could not find the OpenAI key. Set OPENAI_API_KEY, or log in with firebase login so the secret can be read.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cases = SAFETY_CASES.filter((c) => !options.category || c.category === options.category);
  if (!cases.length) throw new Error(`No cases in the category "${options.category}".`);
  const scope = await loadScope();
  let OpenAI;
  try {
    ({ default: OpenAI } = await import('openai'));
  } catch {
    throw new Error('The openai package is missing. Run: cd expo/functions && npm install');
  }
  const openai = new OpenAI({ apiKey: readKey() });
  const fingerprint = safetyFingerprint({
    gatePrompt: scope.GATE_PROMPT, gateModel: scope.GATE_MODEL, scopePolicy: scope.SCOPE_POLICY, refusal: scope.REFUSAL, mainModel: options.model,
  });
  console.log(`Running ${cases.length} cases x ${options.repeat} (main model ${options.model}, topic check ${scope.GATE_MODEL}) ...`);
  const results = await runSafetySet({ openai, scope, cases, coachSystem: COACH_SYSTEM, model: options.model, repeat: options.repeat });
  console.log(formatReport(results, { verbose: options.verbose, fingerprint }).join('\n'));
  if (EXPECTED_FINGERPRINT && fingerprint !== EXPECTED_FINGERPRINT) {
    console.log(`Note: the app's recorded fingerprint is ${EXPECTED_FINGERPRINT}; this run tested ${fingerprint}.`);
  }
  if (options.json) writeFileSync(options.json, JSON.stringify({ fingerprint, summary: summarize(results), results }, null, 2));
  process.exitCode = summarize(results).layers.pipeline.right === results.length ? 0 : 1;
}

main().catch((err) => {
  console.error(`Could not run the safety set: ${err.message}`);
  process.exitCode = 2;
});
