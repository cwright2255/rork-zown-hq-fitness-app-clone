// The invite code's letters live in two places because a deployed function cannot import from the app: the server makes and checks codes
// (functions/src/referrals.js) and the phone tidies what a person types (lib/invite.js). If the lists differ, a real code could be rejected
// while it is being typed.
import { CODE_ALPHABET as server, isValidCode, makeCode } from '../functions/src/referrals';
import { CODE_ALPHABET as phone, typedCode, codeIsComplete } from '../lib/invite';

describe('the invite code letters', () => {
  it('are the same on the server and on the phone', () => {
    expect(phone).toBe(server);
  });

  it('let a code the server made through the box on the phone unchanged, and complete', () => {
    for (let i = 0; i < 100; i += 1) {
      const code = makeCode();
      const typed = typedCode(code);
      expect(typed.replace('-', '')).toBe(code);
      expect(codeIsComplete(typed)).toBe(true);
      expect(isValidCode(typed.replace('-', ''))).toBe(true);
    }
  });
});
