// functions/safety/fingerprint.js
//
// A short code for everything the safety set is a test of: the topic check's instructions and model, the scope rule and refusal sentence,
// and the model that writes the answer. The test __tests__/safetyFingerprint.test.js fails when any of them changes without
// EXPECTED_FINGERPRINT being updated, which is the reminder to run the safety set (docs/SAFETY_TESTS.md) before the change goes live.
// run.js prints the code it tested, so the two can be compared.
import { createHash } from 'node:crypto';

export const EXPECTED_FINGERPRINT = '0be1c16f383d';

export function safetyFingerprint({ gatePrompt, gateModel, scopePolicy, refusal, mainModel }) {
  const text = JSON.stringify({ gatePrompt, gateModel, scopePolicy, refusal, mainModel });
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}
