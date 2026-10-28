import { generateKeyPairSync, verify } from 'node:crypto';
import {
  APPLE_CLIENT_ID,
  APPLE_ISSUER,
  APPLE_REVOKE_URL,
  APPLE_TEAM_ID,
  APPLE_TOKEN_URL,
  AppleRevokeError,
  appleClientSecret,
  appleIdTokenSubject,
  revokeAppleGrant,
} from '../functions/src/appleRevoke';

// A real P-256 key, the kind Apple gives out as a .p8 file, so the signature can be checked for real.
const { privateKey: privateKeyObject, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY = privateKeyObject.export({ type: 'pkcs8', format: 'pem' });
const KEY_ID = 'ABC123DEFG';
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
const signatureIsValid = (jwt) => {
  const [header, payload, signature] = jwt.split('.');
  return verify('sha256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
};
const idTokenFor = (sub) => `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub, aud: APPLE_CLIENT_ID })).toString('base64url')}.sig`;

// A fake fetch that answers in order and remembers what it was asked.
const fakeFetch = (...answers) => {
  const calls = [];
  const fn = jest.fn(async (url, init) => {
    calls.push({ url, init, form: Object.fromEntries(new URLSearchParams(init.body)) });
    const next = answers[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  });
  fn.calls = calls;
  return fn;
};
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => { if (body === undefined) throw new Error('no body'); return body; } });

const grant = (overrides = {}) => ({
  authorizationCode: 'c-one-time-code',
  expectedUserId: '001234.apple.user',
  keyId: KEY_ID,
  privateKey: PRIVATE_KEY,
  now: () => NOW,
  ...overrides,
});
const goodAnswers = () => [
  reply(200, { access_token: 'a-access', refresh_token: 'r-refresh', id_token: idTokenFor('001234.apple.user') }),
  reply(200, undefined),
];
const failure = async (promise) => { try { await promise; } catch (e) { return e; } throw new Error('expected a failure'); };

describe('the ids', () => {
  it('uses the team and the app\'s bundle id (the client id for a code the iOS app made)', () => {
    expect(APPLE_TEAM_ID).toBe('GLFKG8342N');
    expect(APPLE_CLIENT_ID).toBe('com.zownhq.app');
  });
});

describe('appleClientSecret', () => {
  it('is an ES256 token naming the key, the team, the app and Apple, signed with the key', () => {
    const jwt = appleClientSecret({ keyId: KEY_ID, privateKey: PRIVATE_KEY, now: () => NOW });
    const [header, payload] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'ES256', kid: KEY_ID });
    expect(decode(payload)).toEqual({
      iss: 'GLFKG8342N',
      iat: NOW / 1000,
      exp: NOW / 1000 + 300,
      aud: APPLE_ISSUER,
      sub: 'com.zownhq.app',
    });
    expect(signatureIsValid(jwt)).toBe(true);
  });

  it('is not valid for a different key', () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    const jwt = appleClientSecret({ keyId: KEY_ID, privateKey: other, now: () => NOW });
    expect(signatureIsValid(jwt)).toBe(false);
  });

  it('lasts minutes, far less than the 6 months Apple allows, and is dated from the clock it is given', () => {
    const later = appleClientSecret({ keyId: KEY_ID, privateKey: PRIVATE_KEY, now: () => NOW + 60_000 });
    const { iat, exp } = decode(later.split('.')[1]);
    expect(iat).toBe(NOW / 1000 + 60);
    expect(exp - iat).toBeLessThan(15777000);
  });

  it('accepts a key whose line breaks were pasted as the two characters \\n', () => {
    const oneLine = PRIVATE_KEY.trim().replace(/\n/g, '\\n');
    expect(oneLine).not.toContain('\n');
    expect(signatureIsValid(appleClientSecret({ keyId: KEY_ID, privateKey: oneLine, now: () => NOW }))).toBe(true);
  });

  it.each([
    ['no key id', { keyId: '', privateKey: PRIVATE_KEY }],
    ['a blank key id', { keyId: '   ', privateKey: PRIVATE_KEY }],
    ['no key', { keyId: KEY_ID, privateKey: '' }],
    ['a key that is not a key', { keyId: KEY_ID, privateKey: 'not a pem' }],
  ])('says it is not set up with %s', (name, params) => {
    expect(() => appleClientSecret(params)).toThrow(AppleRevokeError);
    try { appleClientSecret(params); } catch (e) { expect(e.code).toBe('not-configured'); }
  });
});

describe('appleIdTokenSubject', () => {
  it('reads who the token is for', () => {
    expect(appleIdTokenSubject(idTokenFor('001234.apple.user'))).toBe('001234.apple.user');
  });
  it.each([[undefined], [null], [''], ['abc'], ['a.b.c'], [idTokenFor(42)]])('gives nothing for %p', (value) => {
    expect(appleIdTokenSubject(value)).toBeNull();
  });
});

describe('revokeAppleGrant', () => {
  it('trades the code for a token, then revokes that token, in that order, at Apple', async () => {
    const fetchImpl = fakeFetch(...goodAnswers());
    const result = await revokeAppleGrant(grant({ fetchImpl }));
    expect(result).toEqual({ revoked: true });
    expect(fetchImpl.calls.map((c) => c.url)).toEqual([APPLE_TOKEN_URL, APPLE_REVOKE_URL]);
    expect(APPLE_TOKEN_URL).toBe('https://appleid.apple.com/auth/token');
    expect(APPLE_REVOKE_URL).toBe('https://appleid.apple.com/auth/revoke');
  });

  it('sends the code with the app\'s id and a client secret signed with the key', async () => {
    const fetchImpl = fakeFetch(...goodAnswers());
    await revokeAppleGrant(grant({ fetchImpl }));
    const [exchange] = fetchImpl.calls;
    expect(exchange.init.method).toBe('POST');
    expect(exchange.init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(exchange.form).toMatchObject({ client_id: 'com.zownhq.app', code: 'c-one-time-code', grant_type: 'authorization_code' });
    expect(signatureIsValid(exchange.form.client_secret)).toBe(true);
  });

  it('revokes the refresh token it got back, not the code', async () => {
    const fetchImpl = fakeFetch(...goodAnswers());
    await revokeAppleGrant(grant({ fetchImpl }));
    const revoke = fetchImpl.calls[1];
    expect(revoke.init.method).toBe('POST');
    expect(revoke.form).toMatchObject({ client_id: 'com.zownhq.app', token: 'r-refresh', token_type_hint: 'refresh_token' });
    expect(revoke.form.token).not.toBe('c-one-time-code');
    expect(signatureIsValid(revoke.form.client_secret)).toBe(true);
  });

  it('ignores spaces around the code', async () => {
    const fetchImpl = fakeFetch(...goodAnswers());
    await revokeAppleGrant(grant({ fetchImpl, authorizationCode: '  c-one-time-code \n' }));
    expect(fetchImpl.calls[0].form.code).toBe('c-one-time-code');
  });

  it('counts the revoke as done when Apple answers 200 with nothing in the body', async () => {
    const fetchImpl = fakeFetch(reply(200, { refresh_token: 'r', id_token: idTokenFor('001234.apple.user') }), reply(200, undefined));
    await expect(revokeAppleGrant(grant({ fetchImpl }))).resolves.toEqual({ revoked: true });
  });

  it('does not revoke a grant that belongs to a different Apple ID than the one linked to the account', async () => {
    const fetchImpl = fakeFetch(reply(200, { refresh_token: 'r', id_token: idTokenFor('999999.someone.else') }), reply(200, undefined));
    const error = await failure(revokeAppleGrant(grant({ fetchImpl })));
    expect(error).toBeInstanceOf(AppleRevokeError);
    expect(error.code).toBe('wrong-account');
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('treats a token with no readable owner as the wrong account when an owner is expected', async () => {
    const fetchImpl = fakeFetch(reply(200, { refresh_token: 'r', id_token: 'junk' }), reply(200, undefined));
    expect((await failure(revokeAppleGrant(grant({ fetchImpl })))).code).toBe('wrong-account');
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it.each([[undefined], ['']])('does not check the owner when none is given (%p)', async (expectedUserId) => {
    const fetchImpl = fakeFetch(reply(200, { refresh_token: 'r', id_token: idTokenFor('anyone') }), reply(200, undefined));
    await expect(revokeAppleGrant(grant({ fetchImpl, expectedUserId }))).resolves.toEqual({ revoked: true });
  });

  it.each([[undefined], [null], [''], ['   '], [42]])('asks for a new code, and calls nobody, when there is none (%p)', async (authorizationCode) => {
    const fetchImpl = fakeFetch();
    const error = await failure(revokeAppleGrant(grant({ fetchImpl, authorizationCode })));
    expect(error.code).toBe('invalid-code');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is not set up when the key is missing, and calls nobody', async () => {
    const fetchImpl = fakeFetch();
    const error = await failure(revokeAppleGrant(grant({ fetchImpl, privateKey: '' })));
    expect(error.code).toBe('not-configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('when Apple says no to the code', () => {
    it('asks for a new code if the code was used, expired or not ours (invalid_grant), and revokes nothing', async () => {
      const fetchImpl = fakeFetch(reply(400, { error: 'invalid_grant' }));
      const error = await failure(revokeAppleGrant(grant({ fetchImpl })));
      expect(error.code).toBe('invalid-code');
      expect(fetchImpl.calls).toHaveLength(1);
    });

    it.each([['invalid_client'], ['unauthorized_client']])('says the key or ids are wrong on %s', async (reason) => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(reply(400, { error: reason })) })));
      expect(error.code).toBe('not-configured');
    });

    it('fails on any other refusal', async () => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(reply(400, { error: 'invalid_request' })) })));
      expect(error.code).toBe('failed');
    });

    it('fails when Apple sends no token back', async () => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(reply(200, { access_token: 'a' })) })));
      expect(error.code).toBe('failed');
    });
  });

  describe('when Apple cannot be reached', () => {
    it('says try again later when the exchange cannot connect', async () => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(new Error('ECONNRESET')) })));
      expect(error.code).toBe('unavailable');
    });

    it('says try again later when Apple has an error of its own (5xx), at either step', async () => {
      expect((await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(reply(503, undefined)) })))).code).toBe('unavailable');
      const second = fakeFetch(reply(200, { refresh_token: 'r', id_token: idTokenFor('001234.apple.user') }), reply(500, undefined));
      expect((await failure(revokeAppleGrant(grant({ fetchImpl: second })))).code).toBe('unavailable');
    });

    it('says try again later when the revoke itself cannot connect', async () => {
      const fetchImpl = fakeFetch(reply(200, { refresh_token: 'r', id_token: idTokenFor('001234.apple.user') }), new Error('socket hang up'));
      expect((await failure(revokeAppleGrant(grant({ fetchImpl })))).code).toBe('unavailable');
    });
  });

  describe('when Apple refuses the revoke', () => {
    const exchanged = reply(200, { refresh_token: 'r', id_token: idTokenFor('001234.apple.user') });

    it('fails, and does not say it worked', async () => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(exchanged, reply(400, { error: 'invalid_request' })) })));
      expect(error.code).toBe('failed');
    });

    it('says the key or ids are wrong on invalid_client', async () => {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl: fakeFetch(exchanged, reply(401, { error: 'invalid_client' })) })));
      expect(error.code).toBe('not-configured');
    });
  });

  it('never puts the code, a token or the key into an error message', async () => {
    const attempts = [
      fakeFetch(reply(400, { error: 'invalid_grant' })),
      fakeFetch(new Error('c-one-time-code r-refresh')),
      fakeFetch(reply(200, { refresh_token: 'r-refresh', id_token: idTokenFor('999') }), reply(200, undefined)),
      fakeFetch(reply(200, { refresh_token: 'r-refresh', id_token: idTokenFor('001234.apple.user') }), reply(400, { error: 'invalid_request' })),
    ];
    for (const fetchImpl of attempts) {
      const error = await failure(revokeAppleGrant(grant({ fetchImpl })));
      for (const secret of ['c-one-time-code', 'r-refresh', 'BEGIN PRIVATE KEY', KEY_ID]) expect(error.message).not.toContain(secret);
    }
  });
});
