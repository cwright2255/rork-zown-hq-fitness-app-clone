// store/duelStore.js getDisplayStatus: what a duel card says. Who won is the server's to say (functions/src/duelSettle.js completes a
// duel that runs to a date once the date has passed): the phone shows the result the server settled and never works one out.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn(), addDoc: jest.fn(), updateDoc: jest.fn(), query: jest.fn(), where: jest.fn(), onSnapshot: jest.fn(),
}));

import { useDuelStore } from '../store/duelStore';

const status = (duel, uid = 'alice') => useDuelStore.getState().getDisplayStatus(duel, uid);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const duel = (over = {}) => ({
  participantIds: ['alice', 'bob'], participantNames: { alice: 'Alice', bob: 'Bob' }, progress: { alice: 3, bob: 2 },
  mode: 'most_by_deadline', status: 'active', endDate: FUTURE, ...over,
});

describe('a duel still running', () => {
  it('shows both scores and says it has not ended', () => {
    expect(status(duel())).toMatchObject({ opponentName: 'Bob', mine: 3, theirs: 2, ended: false, pending: false, tied: false, won: null });
  });

  it('shows the other person\'s side when asked as them', () => {
    expect(status(duel(), 'bob')).toMatchObject({ opponentName: 'Alice', mine: 2, theirs: 3, ended: false });
  });

  it('is not decided on the phone, however far ahead someone is', () => {
    expect(status(duel({ progress: { alice: 99, bob: 0 } })).won).toBeNull();
  });

  it('copes with no progress or names yet', () => {
    expect(status(duel({ progress: undefined, participantNames: undefined }))).toMatchObject({ mine: 0, theirs: 0, opponentName: 'Opponent' });
  });
});

describe('a duel the server has settled', () => {
  it('says the person won, from the winner the server wrote', () => {
    expect(status(duel({ status: 'completed', winnerId: 'alice', tied: false }))).toMatchObject({ ended: true, pending: false, tied: false, won: true });
  });

  it('says the person lost when the other won', () => {
    expect(status(duel({ status: 'completed', winnerId: 'bob', tied: false }))).toMatchObject({ ended: true, pending: false, tied: false, won: false });
    expect(status(duel({ status: 'completed', winnerId: 'bob', tied: false }), 'bob').won).toBe(true);
  });

  it('says a draw, not a loss and not a win, when the server settled it as a tie', () => {
    const tie = duel({ status: 'completed', winnerId: null, tied: true, progress: { alice: 2, bob: 2 } });
    expect(status(tie)).toMatchObject({ ended: true, pending: false, tied: true, won: false });
    expect(status(tie, 'bob')).toMatchObject({ tied: true, won: false });
  });

  it('is a draw only when the server says so, and a win only for the person it names', () => {
    expect(status(duel({ status: 'completed', winnerId: null }))).toMatchObject({ tied: false, won: false });
    expect(status(duel({ status: 'completed', winnerId: null, tied: true }), null)).toMatchObject({ tied: true, won: false });
  });

  it('does not take the scores over the winner the server wrote', () => {
    expect(status(duel({ status: 'completed', winnerId: 'bob', tied: false, progress: { alice: 50, bob: 1 } })).won).toBe(false);
  });

  it('settles a first-to-target duel by its winner, as before', () => {
    expect(status(duel({ mode: 'first_to_target', status: 'completed', winnerId: 'alice', endDate: null })).won).toBe(true);
  });
});

describe('a deadline duel whose date has passed before the server has settled it', () => {
  it('has ended, but its result is not known yet, and the phone does not guess', () => {
    const s = status(duel({ endDate: PAST, progress: { alice: 9, bob: 1 } }));
    expect(s).toMatchObject({ ended: true, pending: true, tied: false, won: null });
  });

  it('is the same for both people and for a tie in the scores', () => {
    expect(status(duel({ endDate: PAST, progress: { alice: 2, bob: 2 } }), 'bob')).toMatchObject({ ended: true, pending: true, won: null });
  });

  it('is not pending for a deadline duel that has no date', () => {
    expect(status(duel({ endDate: null }))).toMatchObject({ ended: false, pending: false });
    expect(status(duel({ endDate: undefined }))).toMatchObject({ ended: false, pending: false });
    expect(status(duel({ endDate: '' }))).toMatchObject({ ended: false, pending: false });
  });

  it('is not pending for a first-to-target duel with a date in the past: that one settles at the target', () => {
    expect(status(duel({ mode: 'first_to_target', endDate: PAST }))).toMatchObject({ ended: false, pending: false });
  });
});
