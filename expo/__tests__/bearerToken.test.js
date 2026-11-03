// Who is calling a plain web-address function (functions/src/bearerToken.js): the Firebase sign-in token in the Authorization header.
// Pure functions with the checking function passed in, so no Firebase is involved.

import { bearerToken, signedInUid } from '../functions/src/bearerToken.js';

const requestWith = (authorization) => ({ headers: { authorization } });

describe('bearerToken', () => {
  it('is the token after the Bearer word', () => {
    expect(bearerToken(requestWith('Bearer abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it('ignores the letter case of the Bearer word and spaces around the header', () => {
    expect(bearerToken(requestWith('bearer abc'))).toBe('abc');
    expect(bearerToken(requestWith('BEARER abc'))).toBe('abc');
    expect(bearerToken(requestWith('  Bearer   abc  '))).toBe('abc');
    expect(bearerToken(requestWith('Bearer\tabc'))).toBe('abc');
  });

  it.each([
    ['no header', { headers: {} }],
    ['no headers', {}],
    ['no request', undefined],
    ['a null request', null],
    ['an empty header', requestWith('')],
    ['a header that is not text', requestWith(['Bearer abc'])],
    ['another kind of sign-in', requestWith('Basic dXNlcjpwYXNz')],
    ['a token with no Bearer word', requestWith('abc')],
    ['the Bearer word alone', requestWith('Bearer')],
    ['the Bearer word and spaces', requestWith('Bearer    ')],
    ['two tokens', requestWith('Bearer abc def')],
    ['a word that only starts with Bearer', requestWith('Bearerabc')],
  ])('is nothing for %s', (_name, req) => {
    expect(bearerToken(req)).toBeNull();
  });

  it('is nothing for a token longer than any Firebase sign-in token', () => {
    expect(bearerToken(requestWith(`Bearer ${'a'.repeat(4096)}`))).toBe('a'.repeat(4096));
    expect(bearerToken(requestWith(`Bearer ${'a'.repeat(4097)}`))).toBeNull();
  });
});

describe('signedInUid', () => {
  it('is the id Firebase finds in the token, and hands Firebase the token alone', async () => {
    const verify = jest.fn(async () => ({ uid: 'u1', email: 'a@b.c' }));
    await expect(signedInUid(requestWith('Bearer good'), verify)).resolves.toBe('u1');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('good');
  });

  it('is nothing, and asks Firebase nothing, when there is no token', async () => {
    const verify = jest.fn();
    await expect(signedInUid({ headers: {} }, verify)).resolves.toBeNull();
    await expect(signedInUid(requestWith('Basic abc'), verify)).resolves.toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it('is nothing when Firebase does not accept the token, however it complains', async () => {
    await expect(signedInUid(requestWith('Bearer bad'), async () => { throw new Error('auth/id-token-expired'); })).resolves.toBeNull();
    await expect(signedInUid(requestWith('Bearer bad'), () => { throw new Error('thrown at once'); })).resolves.toBeNull();
    await expect(signedInUid(requestWith('Bearer bad'), () => Promise.reject('not even an error'))).resolves.toBeNull();
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['no id', {}],
    ['an empty id', { uid: '' }],
    ['an id that is not text', { uid: 42 }],
  ])('is nothing when Firebase answers with %s', async (_name, decoded) => {
    await expect(signedInUid(requestWith('Bearer odd'), async () => decoded)).resolves.toBeNull();
  });
});
