// Whether a test gets its own mock of a firebase module must not depend on which test file ran before it.
//
// Jest runs several test files one after another in the same process and remembers, per importing module, which
// mock a module name stood for. A test that mocks "firebase/functions" with { virtual: true } (dietPrompts,
// alcoholGuidance, llmClient and others do) was then ignored by any module an earlier test file had already loaded
// while only jest.setup.js's mock of that name existed, and the real call went to jest.setup.js's empty stand-in.
// That showed up as "Failed to generate nutrition advice" in a few suites on some runs and not on others, because the
// order the files run in changes with how long each took last time. jest.setup.js now registers its firebase mocks as
// virtual too, so the name means the same mock in every file.
const fs = require('fs');
const path = require('path');

jest.mock('../src/config/firebase', () => ({ functions: { fake: true } }));

describe('mocking a firebase module with { virtual: true }', () => {
  it('reaches a module an earlier test file had already loaded', async () => {
    // Stands in for the earlier test file: it loads the client while only jest.setup.js's mock exists.
    jest.isolateModules(() => { require('../services/llmClient'); });

    // This file's own mock, written the way dietPrompts and alcoholGuidance write theirs.
    const reply = jest.fn(async () => ({ data: { completion: 'from this file\'s mock' } }));
    const mine = jest.fn(() => reply);
    jest.doMock('firebase/functions', () => ({ httpsCallable: mine }), { virtual: true });

    let askLLM;
    jest.isolateModules(() => { ({ askLLM } = require('../services/llmClient')); });
    await expect(askLLM([{ role: 'user', content: 'hi' }])).resolves.toBe('from this file\'s mock');
    expect(mine).toHaveBeenCalledWith({ fake: true }, 'postLLM', { timeout: 60000 });
  });

  it('is kept that way by jest.setup.js, which registers every firebase mock as virtual', () => {
    const setup = fs.readFileSync(path.join(__dirname, '..', 'jest.setup.js'), 'utf8');
    const mocks = setup.split(/\n(?=jest\.mock\()/).filter((chunk) => chunk.startsWith("jest.mock('firebase/"));
    const virtual = Object.fromEntries(mocks.map((chunk) => [
      chunk.match(/^jest\.mock\('([^']+)'/)[1],
      /\{ virtual: true \}\);\s*$/.test(chunk),
    ]));
    expect(virtual).toEqual({
      'firebase/app': true, 'firebase/auth': true, 'firebase/firestore': true, 'firebase/functions': true, 'firebase/storage': true,
    });
  });
});
