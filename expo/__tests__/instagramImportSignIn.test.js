// The app's side of the Instagram recipe import (getInstagramEmbedData in services/recipeExtractionService.js): the request to the
// instagramEmbed function carries the person's sign-in token, and the function's 401 and 429 answers come back as the reason shown.
// The function itself is tested in instagramEmbedFunction.test.js.

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }), { virtual: true });
jest.mock('@/services/llmClient', () => ({ askLLM: jest.fn() }));
const mockSignInHeader = jest.fn();
jest.mock('../lib/signInHeader', () => ({ signInHeader: (...args) => mockSignInHeader(...args) }));

import recipeExtractionService from '../services/recipeExtractionService';

const POST = 'https://www.instagram.com/p/ABC123/';
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  mockSignInHeader.mockReset();
  mockSignInHeader.mockResolvedValue({ Authorization: 'Bearer token-abc' });
  global.fetch = jest.fn(async () => reply(200, { caption: 'Garlic pasta', username: 'chef.amy', thumbnail: 'https://cdn.example/pic.jpg' }));
  recipeExtractionService.lastDiagnostic = null;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('Instagram recipe import: the request', () => {
  it('goes to the instagramEmbed function with the link and the person\'s sign-in token', async () => {
    await recipeExtractionService.getInstagramEmbedData(POST);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [address, options] = global.fetch.mock.calls[0];
    expect(address).toBe('https://us-central1-zown-3c512.cloudfunctions.net/instagramEmbed');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-abc' });
    expect(JSON.parse(options.body)).toEqual({ url: POST });
  });

  it('sends no Authorization header when nobody is signed in, and the function\'s answer says why', async () => {
    mockSignInHeader.mockResolvedValue({});
    global.fetch.mockResolvedValue(reply(401, { error: 'Sign in to import from Instagram.' }));
    const result = await recipeExtractionService.getInstagramEmbedData(POST);
    expect(global.fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(result).toBeNull();
    expect(recipeExtractionService.lastDiagnostic).toBe('Sign in to import from Instagram.');
  });

  it('sends nothing when the token cannot be read, and says the call failed', async () => {
    mockSignInHeader.mockRejectedValue(new Error('auth/network-request-failed'));
    const result = await recipeExtractionService.getInstagramEmbedData(POST);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toBeNull();
    expect(recipeExtractionService.lastDiagnostic).toBe('Instagram proxy call failed: auth/network-request-failed');
  });
});

describe('Instagram recipe import: the answer', () => {
  it('gives back the caption, the account and the picture', async () => {
    await expect(recipeExtractionService.getInstagramEmbedData(POST)).resolves.toEqual({
      caption: 'Garlic pasta',
      username: 'chef.amy',
      thumbnail: 'https://cdn.example/pic.jpg',
    });
  });

  it('shows the daily limit\'s own sentence when the function says 429', async () => {
    global.fetch.mockResolvedValue(reply(429, { error: 'That is today\'s limit for importing from Instagram. Try again tomorrow.' }));
    await expect(recipeExtractionService.getInstagramEmbedData(POST)).resolves.toBeNull();
    expect(recipeExtractionService.lastDiagnostic).toBe('That is today\'s limit for importing from Instagram. Try again tomorrow.');
  });

  it('names the status when the answer has no reason in it', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => { throw new Error('not json'); } });
    await expect(recipeExtractionService.getInstagramEmbedData(POST)).resolves.toBeNull();
    expect(recipeExtractionService.lastDiagnostic).toBe('Instagram proxy returned HTTP 503');
  });
});
