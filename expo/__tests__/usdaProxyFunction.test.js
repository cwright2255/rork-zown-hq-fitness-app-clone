// The cloud function that holds the USDA FoodData Central key so the app does not (searchUsdaFoods in functions/src/index.js), the
// check on the words it is sent (foodSearchText in proxyInput.js) and the cutting down of USDA's answer (usdaFoods.js). index.js is loaded
// with the Firebase packages replaced by small fakes, and fetch replaced, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => (global.__secrets && global.__secrets[name]) || 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

import { foodSearchText } from '../functions/src/proxyInput.js';
import { trimUsdaFoods } from '../functions/src/usdaFoods.js';

const AUTH = { uid: 'u1' };
const USDA = 'https://api.nal.usda.gov/fdc/v1';

// A nutrient as FoodData Central's search sends it.
const nut = (nutrientNumber, value, unitName, nutrientName = 'x') => ({ nutrientNumber: String(nutrientNumber), nutrientName, unitName, value });
const orangeJuice = {
  fdcId: 169098, description: 'Orange juice, raw', dataType: 'SR Legacy',
  foodNutrients: [nut(208, 45, 'KCAL'), nut(203, 0.7, 'G'), nut(204, 0.2, 'G'), nut(205, 10.4, 'G'), nut(291, 0.2, 'G'), nut(307, 1, 'MG'), nut(606, 0.024, 'G'), nut(269, 8.4, 'G')],
};

describe('foodSearchText', () => {
  it('gives back the words, trimmed and with runs of spaces made single', () => {
    expect(foodSearchText('Orange Juice')).toBe('Orange Juice');
    expect(foodSearchText('  Orange   \t Juice  ')).toBe('Orange Juice');
    expect(foodSearchText('Orange\nJuice')).toBe('Orange Juice'); // a line break is a space, not a control character to refuse
  });

  it('takes 2 to 80 characters', () => {
    expect(foodSearchText('ab')).toBe('ab');
    expect(foodSearchText('a'.repeat(80))).toBe('a'.repeat(80));
    expect(foodSearchText('a')).toBeNull();
    expect(foodSearchText(' a ')).toBeNull();
    expect(foodSearchText('a'.repeat(81))).toBeNull();
  });

  it.each([[undefined], [null], [''], ['   '], [42], [true], [{}], [['tofu']], ['to\u0000fu'], ['tofu\u007f'], ['to\u001bfu'], ['to\u001ffu'], ['to\u0001fu']])('refuses %j', (value) => {
    expect(foodSearchText(value)).toBeNull();
  });
});

describe('trimUsdaFoods', () => {
  it('keeps the few figures the app compares, from the nutrient numbers', () => {
    expect(trimUsdaFoods({ foods: [orangeJuice] })).toEqual([
      { fdcId: 169098, description: 'Orange juice, raw', dataType: 'SR Legacy', kcal: 45, protein: 0.7, fat: 0.2, carbs: 10.4, fibre: 0.2, sodium: 1, satFat: 0.024 },
    ]);
  });

  it('has null for a figure the food does not list', () => {
    const food = { fdcId: 1, description: 'Rice flour', dataType: 'Foundation', foodNutrients: [nut(208, 365, 'KCAL'), nut(203, 7.19, 'G')] };
    expect(trimUsdaFoods({ foods: [food] })[0]).toMatchObject({ kcal: 365, protein: 7.19, fat: null, carbs: null, fibre: null, sodium: null, satFat: null });
  });

  it('takes the energy of a Foundation food that has no 208 from the Atwater figures', () => {
    const energy = (...nutrients) => trimUsdaFoods({ foods: [{ foodNutrients: nutrients }] })[0].kcal;
    expect(energy(nut(957, 300, 'KCAL'), nut(958, 310, 'KCAL'))).toBe(300);
    expect(energy(nut(958, 310, 'KCAL'))).toBe(310);
    expect(energy(nut(958, 310, 'KCAL'), nut(957, 300, 'KCAL'), nut(208, 305, 'KCAL'))).toBe(305);
    expect(energy(nut(203, 1, 'G'))).toBeNull();
  });

  it('reads the abridged form of a food\'s nutrients too (number, amount)', () => {
    expect(trimUsdaFoods({ foods: [{ foodNutrients: [{ number: '307', amount: 12, unitName: 'mg' }] }] })[0].sodium).toBe(12);
  });

  it('takes the first of a nutrient that is listed twice', () => {
    expect(trimUsdaFoods({ foods: [{ foodNutrients: [nut(307, 5, 'MG'), nut(307, 99, 'MG')] }] })[0].sodium).toBe(5);
  });

  it('does not take a figure in a unit it did not expect, or one that is not a plain amount', () => {
    const figure = (n) => trimUsdaFoods({ foods: [{ foodNutrients: [n] }] })[0];
    expect(figure(nut(307, 1, 'G')).sodium).toBeNull();
    expect(figure(nut(208, 188, 'KJ')).kcal).toBeNull();
    expect(figure(nut(291, 2, 'MG')).fibre).toBeNull();
    expect(figure(nut(307, -1, 'MG')).sodium).toBeNull();
    expect(figure(nut(307, 'lots', 'MG')).sodium).toBeNull();
    expect(figure(nut(307, NaN, 'MG')).sodium).toBeNull();
    expect(figure(nut(307, Infinity, 'MG')).sodium).toBeNull();
    expect(figure(nut(307, null, 'MG')).sodium).toBeNull();
    expect(figure({ nutrientNumber: '307', value: 7 }).sodium).toBe(7); // no unit given: taken as the usual one
    expect(figure(nut(307, 0, 'MG')).sodium).toBe(0); // a real 0 is a figure
    expect(figure(nut(307, 7, 'mg')).sodium).toBe(7);
  });

  it('ignores nutrients it has no use for', () => {
    expect(Object.keys(trimUsdaFoods({ foods: [orangeJuice] })[0]).sort()).toEqual(
      ['carbs', 'dataType', 'description', 'fat', 'fdcId', 'fibre', 'kcal', 'protein', 'satFat', 'sodium']
    );
  });

  it('sends 25 foods at most', () => {
    const foods = Array.from({ length: 40 }, (_, i) => ({ fdcId: i, description: `food ${i}`, dataType: 'SR Legacy', foodNutrients: [] }));
    const out = trimUsdaFoods({ foods });
    expect(out).toHaveLength(25);
    expect(out[24].fdcId).toBe(24);
  });

  it('copes with an answer that is not what it expects', () => {
    expect(trimUsdaFoods(undefined)).toEqual([]);
    expect(trimUsdaFoods(null)).toEqual([]);
    expect(trimUsdaFoods({})).toEqual([]);
    expect(trimUsdaFoods({ foods: 'x' })).toEqual([]);
    expect(trimUsdaFoods({ foods: [null, 5, {}] })).toEqual([
      expect.objectContaining({ fdcId: null, description: '', dataType: '', kcal: null }),
      expect.objectContaining({ fdcId: null, description: '', dataType: '' }),
      expect.objectContaining({ fdcId: null, description: '', dataType: '' }),
    ]);
    expect(trimUsdaFoods({ foods: [{ description: 5, dataType: 7, foodNutrients: 'x' }] })[0]).toMatchObject({ description: '', dataType: '', kcal: null });
    expect(trimUsdaFoods({ foods: [{ foodNutrients: [null, 4, {}] }] })[0].kcal).toBeNull();
  });
});

describe('searchUsdaFoods', () => {
  let fns;
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  const call = (data, auth = AUTH) => fns.searchUsdaFoods({ auth, data });

  beforeEach(() => {
    jest.resetModules();
    fns = require('../functions/src/index.js');
    global.fetch = jest.fn(async () => json({ foods: [orangeJuice] }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

  it('needs a signed-in caller', async () => {
    await expect(call({ query: 'orange juice' }, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(call({ query: 'orange juice' }, {})).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the key in this function, with one region and a cap on how many copies run', () => {
    const opts = fns.searchUsdaFoods.__opts;
    expect(opts.secrets.map((s) => s.name)).toEqual(['USDA_API_KEY']);
    expect(opts.region).toBe('us-central1');
    expect(opts.maxInstances).toBe(10);
    expect(opts.timeoutSeconds).toBe(15);
  });

  it('asks the generic foods of FoodData Central for the words, 25 at most, with the key from the server', async () => {
    const answer = await call({ query: 'Orange  Juice' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(
      `${USDA}/foods/search?query=Orange%20Juice&dataType=Foundation%2CSR%20Legacy&pageSize=25&api_key=secret-USDA_API_KEY`
    );
    expect(answer).toEqual({ foods: [expect.objectContaining({ fdcId: 169098, description: 'Orange juice, raw', kcal: 45, sodium: 1 })] });
  });

  it('writes a key with characters that mean something in an address so that they mean nothing', async () => {
    global.__secrets = { USDA_API_KEY: 'a+b/c=d&e#f g' };
    try {
      await call({ query: 'tofu' });
    } finally {
      delete global.__secrets;
    }
    const url = global.fetch.mock.calls[0][0];
    expect(url.endsWith('&api_key=a%2Bb%2Fc%3Dd%26e%23f%20g')).toBe(true);
    expect(url.match(/api_key=/g)).toHaveLength(1);
  });

  it('keeps what the app sends from changing the address', async () => {
    await call({ query: 'tofu&api_key=other#x/../y' });
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('query=tofu%26api_key%3Dother%23x%2F..%2Fy&');
    expect(url.match(/api_key=/g)).toHaveLength(1);
    expect(url.startsWith(`${USDA}/foods/search?`)).toBe(true);
  });

  it.each([[undefined], [{}], [{ query: '' }], [{ query: ' ' }], [{ query: 'a' }], [{ query: 5 }], [{ query: ['tofu'] }], [{ query: 'x'.repeat(81) }], [{ query: 'to\u0000fu' }]])(
    'refuses %j without calling USDA',
    async (data) => {
      await expect(call(data)).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('says so, without the key or the address, when USDA refuses', async () => {
    global.fetch.mockResolvedValue(json({ error: 'OVER_RATE_LIMIT' }, 429));
    const error = await call({ query: 'tofu' }).catch((e) => e);
    expect(error).toMatchObject({ code: 'internal' });
    expect(error.message).toBe('USDA search failed: 429');
    expect(console.warn).toHaveBeenCalledWith('[searchUsdaFoods] request failed', { status: 429 });
    for (const [first, second] of [...console.warn.mock.calls, ...console.error.mock.calls]) {
      expect(JSON.stringify([first, second])).not.toContain('secret-');
    }
  });

  it('says so, without the key, when USDA cannot be reached', async () => {
    global.fetch.mockRejectedValue(new Error('connect ETIMEDOUT https://api.nal.usda.gov/...api_key=secret-USDA_API_KEY'));
    const error = await call({ query: 'tofu' }).catch((e) => e);
    expect(error).toMatchObject({ code: 'internal', message: 'USDA search could not be reached' });
    expect(error.message).not.toContain('secret-');
    expect(JSON.stringify(console.warn.mock.calls)).not.toContain('secret-');
  });

  it('says so when the answer is not JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(call({ query: 'tofu' })).rejects.toMatchObject({ code: 'internal', message: 'USDA search sent no readable answer' });
  });

  it('sends an empty list for an answer with no foods in it', async () => {
    global.fetch.mockResolvedValue(json({ totalHits: 0 }));
    expect(await call({ query: 'zzzz' })).toEqual({ foods: [] });
  });
});
