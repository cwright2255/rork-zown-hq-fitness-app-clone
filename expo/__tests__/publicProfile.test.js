// The name and picture put on a post, a comment and a conversation (services/publicProfile.js). The rules (firestore.rules) accept a
// post, comment or conversation only when they are the ones on the author's profile, so this reads the profile, fills in what it
// lacks, and hands back exactly what the profile then holds. What the rules do with them is checked in rules-tests/social.test.js.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
let mockStored;
let mockReadFails;
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(async () => {
    if (mockReadFails) throw new Error('offline');
    return { exists: () => mockStored !== null, data: () => mockStored };
  }),
  setDoc: jest.fn(async () => undefined),
}));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { choosePublicProfile, ensurePublicProfile, DEFAULT_NAME } from '../services/publicProfile';

const PIC = 'https://img.example/a.jpg';
const OTHER_PIC = 'https://img.example/b.jpg';

let warn;
beforeEach(() => {
  jest.clearAllMocks();
  mockStored = { name: 'Alice', profileImage: PIC };
  mockReadFails = false;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('choosePublicProfile', () => {
  it('uses the name on the profile, whatever name the screen has', () => {
    expect(choosePublicProfile({ name: 'Alice Smith' }, { name: 'alice_runs' })).toMatchObject({ name: 'Alice Smith', patch: {} });
  });

  it('uses the profile\'s name exactly as it is, as the rules compare with exactly that', () => {
    expect(choosePublicProfile({ name: '  Alice  ' }, { name: 'Alice' }).name).toBe('  Alice  ');
  });

  it('takes the screen\'s name, and saves it to the profile, when the profile has none', () => {
    expect(choosePublicProfile({}, { name: '  Alice  ' })).toEqual({ name: 'Alice', avatar: null, patch: { name: 'Alice' } });
    expect(choosePublicProfile({ name: '' }, { name: 'Alice' }).patch).toEqual({ name: 'Alice' });
  });

  it('shows Zown User, and saves no name, for someone with no name anywhere', () => {
    expect(choosePublicProfile({}, {})).toEqual({ name: DEFAULT_NAME, avatar: null, patch: {} });
    expect(choosePublicProfile({ name: '' }, { name: '   ' }).patch).toEqual({});
    expect(choosePublicProfile({ name: 7 }, { name: null })).toMatchObject({ name: 'Zown User' });
    expect(DEFAULT_NAME).toBe('Zown User');
  });

  it('cuts a long name from the screen to 100 characters before saving it', () => {
    expect(choosePublicProfile({}, { name: 'x'.repeat(150) }).name).toBe('x'.repeat(100));
  });

  it('uses the screen\'s picture and saves it when it is not the one on the profile', () => {
    expect(choosePublicProfile({ name: 'A', profileImage: PIC }, { avatar: OTHER_PIC })).toEqual({ name: 'A', avatar: OTHER_PIC, patch: { profileImage: OTHER_PIC } });
    expect(choosePublicProfile({ name: 'A' }, { avatar: PIC }).patch).toEqual({ profileImage: PIC });
  });

  it('saves nothing when the profile already holds the picture', () => {
    expect(choosePublicProfile({ name: 'A', profileImage: PIC }, { avatar: PIC }).patch).toEqual({});
  });

  it('keeps the picture on the profile when the screen has none, or one that is not a web address', () => {
    expect(choosePublicProfile({ profileImage: PIC }, {}).avatar).toBe(PIC);
    expect(choosePublicProfile({ profileImage: PIC }, { avatar: null }).avatar).toBe(PIC);
    expect(choosePublicProfile({ profileImage: PIC }, { avatar: 'file:///data/user/0/me.jpg' })).toMatchObject({ avatar: PIC, patch: {} });
    expect(choosePublicProfile({ profileImage: PIC }, { avatar: '' }).avatar).toBe(PIC);
  });

  it('has no picture when neither has one', () => {
    expect(choosePublicProfile({ name: 'A' }, { avatar: 'file:///me.jpg' })).toEqual({ name: 'A', avatar: null, patch: {} });
    expect(choosePublicProfile({ profileImage: '' }, {}).avatar).toBeNull();
  });

  it('does not take a picture address longer than 2000 characters', () => {
    const long = 'https://img.example/' + 'x'.repeat(2000);
    expect(choosePublicProfile({}, { avatar: long })).toMatchObject({ avatar: null, patch: {} });
    const exactly = 'https://img.example/' + 'x'.repeat(2000 - 'https://img.example/'.length);
    expect(exactly).toHaveLength(2000);
    expect(choosePublicProfile({}, { avatar: exactly }).avatar).toBe(exactly);
  });

  it('copes with nothing at all', () => {
    expect(choosePublicProfile()).toEqual({ name: 'Zown User', avatar: null, patch: {} });
  });
});

describe('ensurePublicProfile', () => {
  it('reads the person\'s own profile document', async () => {
    await ensurePublicProfile('alice', { name: 'Alice', avatar: PIC });
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'users', 'alice');
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('gives back what the profile holds, and writes nothing when it already holds it', async () => {
    expect(await ensurePublicProfile('alice', { name: 'alice_runs', avatar: PIC })).toEqual({ name: 'Alice', avatar: PIC });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('fills in a name and picture the profile lacks, merging so nothing else on it is touched', async () => {
    mockStored = { email: 'a@example.com', fitnessLevel: 'beginner' };
    expect(await ensurePublicProfile('alice', { name: 'Alice', avatar: PIC })).toEqual({ name: 'Alice', avatar: PIC });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/alice' }, { name: 'Alice', profileImage: PIC }, { merge: true });
  });

  it('makes the profile when there is none', async () => {
    mockStored = null;
    expect(await ensurePublicProfile('alice', { name: 'Alice' })).toEqual({ name: 'Alice', avatar: null });
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/alice' }, { name: 'Alice' }, { merge: true });
  });

  it('saves the new picture when the screen has a different one', async () => {
    expect(await ensurePublicProfile('alice', { name: 'Alice', avatar: OTHER_PIC })).toEqual({ name: 'Alice', avatar: OTHER_PIC });
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/alice' }, { profileImage: OTHER_PIC }, { merge: true });
  });

  it('gives Zown User and no picture, and saves nothing, for someone with neither', async () => {
    mockStored = {};
    expect(await ensurePublicProfile('alice', {})).toEqual({ name: 'Zown User', avatar: null });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('saves the profile before it returns, so the post written next finds it there', async () => {
    mockStored = {};
    let saved = false;
    setDoc.mockImplementationOnce(async () => { await Promise.resolve(); saved = true; });
    await ensurePublicProfile('alice', { name: 'Alice' });
    expect(saved).toBe(true);
  });

  it('uses what the screen has, and saves nothing, when the profile cannot be read (offline)', async () => {
    mockReadFails = true;
    expect(await ensurePublicProfile('alice', { name: 'Alice', avatar: PIC })).toEqual({ name: 'Alice', avatar: PIC });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('still gives the name and picture when saving them fails: the rules then decide', async () => {
    mockStored = {};
    setDoc.mockRejectedValueOnce(new Error('denied'));
    expect(await ensurePublicProfile('alice', { name: 'Alice', avatar: PIC })).toEqual({ name: 'Alice', avatar: PIC });
    expect(warn).toHaveBeenCalled();
  });
});
