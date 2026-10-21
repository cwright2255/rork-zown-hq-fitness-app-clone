// Keeps "run the safety set before changing a prompt or a model" from being forgotten. The code below stands for everything the set
// tests: the topic check's instructions and model, the scope rule, the refusal sentence, and the model that writes the answer. When this
// test fails, one of them changed: run the safety set (cd expo/functions && node safety/run.js, see docs/SAFETY_TESTS.md), and only when
// it passes put the code it printed ("Tested prompts and models") into EXPECTED_FINGERPRINT in functions/safety/fingerprint.js.
import fs from 'fs';
import path from 'path';
import { EXPECTED_FINGERPRINT, safetyFingerprint } from '../functions/safety/fingerprint';
import { MAIN_MODEL } from '../functions/safety/check';

jest.mock('firebase-functions/v2/https', () => ({ HttpsError: class HttpsError extends Error {} }), { virtual: true });

const scope = require('../functions/src/scope.js');

const parts = () => ({ gatePrompt: scope.GATE_PROMPT, gateModel: scope.GATE_MODEL, scopePolicy: scope.SCOPE_POLICY, refusal: scope.REFUSAL, mainModel: MAIN_MODEL });
const index = fs.readFileSync(path.join(__dirname, '..', 'functions', 'src', 'index.js'), 'utf8');
const postLLM = index.slice(index.indexOf('export const postLLM'), index.indexOf('export const generateBodyCompositionInsight'));

describe('the code for what the safety set tests', () => {
  it('is the recorded one: the prompts and models have not changed since the safety set last passed', () => {
    expect(safetyFingerprint(parts())).toBe(EXPECTED_FINGERPRINT);
  });

  it('is twelve letters and digits, and the same every time', () => {
    expect(safetyFingerprint(parts())).toMatch(/^[0-9a-f]{12}$/);
    expect(safetyFingerprint(parts())).toBe(safetyFingerprint(parts()));
  });

  it.each(['gatePrompt', 'gateModel', 'scopePolicy', 'refusal', 'mainModel'])('changes when the %s changes, by one character', (field) => {
    const changed = { ...parts(), [field]: `${parts()[field]}.` };
    expect(safetyFingerprint(changed)).not.toBe(safetyFingerprint(parts()));
  });

  it('does not mix up one field with the next', () => {
    expect(safetyFingerprint({ ...parts(), gateModel: 'ab', scopePolicy: 'c' })).not.toBe(safetyFingerprint({ ...parts(), gateModel: 'a', scopePolicy: 'bc' }));
  });
});

describe('what the safety set runs against', () => {
  it('asks the same main model as postLLM does', () => {
    const model = postLLM.match(/askWithinScope\(openai, \{ model: '([^']+)', messages \}/);
    expect(model && model[1]).toBe(MAIN_MODEL);
  });

  it('runs the topic check and the answer together in postLLM, as the runner does', () => {
    expect(postLLM).toContain("askWithinScope(openai, { model: 'gpt-4o', messages }, { parallel: true })");
  });
});
