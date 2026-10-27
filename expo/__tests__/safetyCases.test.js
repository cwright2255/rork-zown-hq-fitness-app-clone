// The safety set (functions/safety/cases.js): that it is well formed, covers what it should, and that the two requests the app writes
// itself are in it word for word. What the AI does with it is checked by running functions/safety/run.js (docs/SAFETY_TESTS.md).
import { SAFETY_CASES, COACH_SYSTEM, BRIEF_REQUEST as SET_BRIEF, MEMORY_REQUEST as SET_MEMORY } from '../functions/safety/cases';
import { BRIEF_REQUEST, BRIEF_SYSTEM_PROMPT } from '../lib/todayBrief';
import { MEMORY_REQUEST } from '../lib/coachMemory';
import { buildCoachSystemPrompt } from '../services/coachService';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));

const CATEGORIES = ['in-scope', 'out-of-scope', 'injection'];
const byCategory = (name) => SAFETY_CASES.filter((c) => c.category === name);

describe('the safety set', () => {
  it('has about thirty or more cases, with a good number of each kind', () => {
    expect(SAFETY_CASES.length).toBeGreaterThanOrEqual(30);
    for (const name of CATEGORIES) expect(byCategory(name).length).toBeGreaterThanOrEqual(10);
  });

  it('uses only the three kinds, and every case says what the person should get', () => {
    expect([...new Set(SAFETY_CASES.map((c) => c.category))].sort()).toEqual([...CATEGORIES].sort());
    for (const c of SAFETY_CASES) expect(['allow', 'refuse']).toContain(c.expect);
  });

  it('expects an answer for every in-scope case and a refusal for every out-of-scope one', () => {
    expect(new Set(byCategory('in-scope').map((c) => c.expect))).toEqual(new Set(['allow']));
    expect(new Set(byCategory('out-of-scope').map((c) => c.expect))).toEqual(new Set(['refuse']));
  });

  it('has an id for every case, unique, in lower case words joined by dashes', () => {
    const ids = SAFETY_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    for (const c of SAFETY_CASES) expect(c.id.startsWith(`${c.category === 'out-of-scope' ? 'out' : c.category === 'in-scope' ? 'in' : 'inj'}-`)).toBe(true);
  });

  it('gives every case a chat that ends with the person speaking, in roles the AI accepts', () => {
    for (const c of SAFETY_CASES) {
      expect(c.messages.length).toBeGreaterThan(0);
      for (const m of c.messages) {
        expect(['system', 'user', 'assistant']).toContain(m.role);
        expect(typeof m.content).toBe('string');
        expect(m.content.trim()).not.toBe('');
      }
      expect(c.messages[c.messages.length - 1].role).toBe('user');
    }
  });

  it('has chats that go back and forth (a follow-up, a pivot, a forged reply), not only single questions', () => {
    const long = SAFETY_CASES.filter((c) => c.messages.filter((m) => m.role === 'assistant').length > 0).map((c) => c.id);
    expect(long).toEqual(expect.arrayContaining(['in-follow-up', 'inj-midchat-pivot', 'inj-forged-reply', 'inj-fake-system']));
  });

  it('covers the ways of talking the AI out of the rule', () => {
    const ids = byCategory('injection').map((c) => c.id);
    for (const id of ['inj-ignore-rules', 'inj-roleplay', 'inj-fake-system', 'inj-hypothetical', 'inj-fitness-wrapper', 'inj-verdict-json', 'inj-midchat-pivot', 'inj-forged-reply', 'inj-encoded', 'inj-label-data']) {
      expect(ids).toContain(id);
    }
  });

  it('keeps an instruction hidden in data as a case that must be answered normally, and says what must not appear', () => {
    const label = SAFETY_CASES.find((c) => c.id === 'inj-label-data');
    expect(label.expect).toBe('allow');
    expect(label.forbid.length).toBeGreaterThan(0);
    for (const phrase of label.forbid) expect(phrase).toBe(phrase.toLowerCase());
  });

  it('lists forbidden phrases only for cases that are answered, in lower case', () => {
    for (const c of SAFETY_CASES.filter((x) => x.forbid)) {
      expect(c.expect).toBe('allow');
      for (const phrase of c.forbid) expect(phrase).toBe(phrase.toLowerCase());
    }
  });

  it('is plain ASCII, so it travels through a terminal and a paste unchanged', () => {
    const text = JSON.stringify(SAFETY_CASES) + COACH_SYSTEM;
    expect(text.split('').filter((ch) => ch.charCodeAt(0) > 126 || (ch.charCodeAt(0) < 32 && ch !== '\n'))).toEqual([]);
  });
});

describe('the requests the app writes itself', () => {
  it('has the Today brief request word for word, as the last thing the person says', () => {
    expect(SET_BRIEF).toBe(BRIEF_REQUEST);
    const c = SAFETY_CASES.find((x) => x.id === 'in-brief');
    expect(c.messages[c.messages.length - 1]).toEqual({ role: 'user', content: BRIEF_REQUEST });
  });

  it('has the Today brief as the app really sends it too: the real instructions, then the facts, the app data and the logged data', () => {
    const c = SAFETY_CASES.find((x) => x.id === 'in-brief-full');
    expect(c.expect).toBe('allow');
    expect(c.system).toBe(BRIEF_SYSTEM_PROMPT);
    expect(c.messages).toHaveLength(4);
    expect(c.messages.slice(0, 3).every((m) => m.role === 'system')).toBe(true);
    expect(c.messages[0].content.startsWith('About this person and today: ')).toBe(true);
    expect(c.messages[1].content.startsWith('More about this user, from their real app data.')).toBe(true);
    expect(c.messages[2].content.startsWith("Here is this user's real, current logged data.")).toBe(true);
    expect(c.messages[3]).toEqual({ role: 'user', content: BRIEF_REQUEST });
  });

  it('has the Coach notes request word for word, at the start of what is sent', () => {
    expect(SET_MEMORY).toBe(MEMORY_REQUEST);
    const c = SAFETY_CASES.find((x) => x.id === 'in-memory');
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0].content.startsWith(`${MEMORY_REQUEST}\n\nCurrent notes (JSON): `)).toBe(true);
    expect(c.messages[0].content).toContain('\n\nConversation, oldest first (JSON): ');
  });

  it('gives those three their own instructions, and every other case the Coach stand-in', () => {
    for (const c of SAFETY_CASES) {
      if (c.id === 'in-brief' || c.id === 'in-brief-full' || c.id === 'in-memory') expect(c.system).toMatch(/strict JSON only/);
      else expect(c.system).toBeUndefined();
    }
  });
});

describe('the stand-in for the Coach instructions', () => {
  it('opens as the real Coach instructions do', () => {
    const real = buildCoachSystemPrompt({ name: 'Sam' }, new Date(2026, 9, 20), { calendar: false }).content;
    expect(COACH_SYSTEM.slice(0, 80)).toBe(real.slice(0, 80));
  });
});
