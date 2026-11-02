// What happens to the account of someone who enters a date of birth that makes them younger than 13 (services/underageRemoval.js).
import {
  removeUnderageAccount, PRIVACY_EMAIL, UNDERAGE_TITLE, UNDERAGE_MESSAGES,
} from '../services/underageRemoval';

let calls;
const make = ({ currentUser = { uid: 'u1' }, deleteFails = false, endFails = false } = {}) => {
  calls = [];
  return {
    auth: { currentUser },
    deleteAccount: jest.fn(async () => {
      calls.push('delete');
      if (deleteFails) throw new Error('recent-login-required');
    }),
    endSession: jest.fn(async () => {
      calls.push('end');
      if (endFails) throw new Error('storage broke');
    }),
  };
};

beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

describe('removing the account of someone under 13', () => {
  it('removes the account, then signs out and clears the phone, and says it is removed', async () => {
    const args = make();
    expect(await removeUnderageAccount(args)).toEqual({ removed: true });
    expect(args.deleteAccount).toHaveBeenCalledTimes(1);
    expect(args.endSession).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['delete', 'end']); // the phone is cleaned only after the account is gone
  });

  it('still signs out and clears the phone when the account cannot be removed, and says it is not removed', async () => {
    const args = make({ deleteFails: true });
    expect(await removeUnderageAccount(args)).toEqual({ removed: false });
    expect(args.endSession).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['delete', 'end']);
  });

  it('counts nobody signed in as removed, without calling the function', async () => {
    const args = make({ currentUser: null });
    expect(await removeUnderageAccount(args)).toEqual({ removed: true });
    expect(args.deleteAccount).not.toHaveBeenCalled();
    expect(args.endSession).toHaveBeenCalledTimes(1);
  });

  it('counts no Firebase at all (a preview build) as removed', async () => {
    const args = make();
    expect(await removeUnderageAccount({ ...args, auth: undefined })).toEqual({ removed: true });
    expect(args.deleteAccount).not.toHaveBeenCalled();
  });

  it('does not throw if clearing the phone fails, and keeps the answer about the account', async () => {
    expect(await removeUnderageAccount(make({ endFails: true }))).toEqual({ removed: true });
    expect(await removeUnderageAccount(make({ endFails: true, deleteFails: true }))).toEqual({ removed: false });
  });
});

describe('what the person is told', () => {
  it('says the age, that the account was removed, and that nothing was kept', () => {
    expect(UNDERAGE_TITLE).toMatch(/13/);
    expect(UNDERAGE_MESSAGES.removed).toMatch(/13 or older/);
    expect(UNDERAGE_MESSAGES.removed).toMatch(/removed the account/);
    expect(UNDERAGE_MESSAGES.removed).toMatch(/nothing from it was kept/);
  });

  it('says the account is still there, and how to have it removed, when it could not be', () => {
    expect(UNDERAGE_MESSAGES.failed).toMatch(/could not remove the account/);
    expect(UNDERAGE_MESSAGES.failed).toMatch(/signed out/);
    expect(UNDERAGE_MESSAGES.failed).toContain(PRIVACY_EMAIL);
    expect(PRIVACY_EMAIL).toBe('privacy@zownhq.com');
  });
});
