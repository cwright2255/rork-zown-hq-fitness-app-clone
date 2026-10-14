// What the AI is told about alcohol (lib/alcoholGuidance.js): the Coach prompt, the client nutrition advice request,
// the cloud nutrition-targets notes (functions/src/nutritionKnowledge.js), the topic check that lets an alcohol
// question through (functions/src/scope.js), and the knowledge doc all of it comes from. The model itself is faked.

const fs = require('fs');
const path = require('path');

jest.mock('@/store/expStore', () => ({ useExpStore: { getState: () => ({ addExpActivity: jest.fn() }) } }));
jest.mock('@/services/wearableService', () => ({ wearableService: { getMoodDataFromWearables: jest.fn(async () => null) } }));
jest.mock('@/store/userStore', () => ({ useUserStore: { getState: () => ({ user: { uid: 'u1', name: 'Sam', fitnessMetrics: { nutritionPreference: 'no_preference' } } }) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: (...a) => global.__httpsCallable(...a) }), { virtual: true });
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ functions: { fake: true }, db: {} }));
jest.mock('firebase-functions/v2/https', () => ({ HttpsError: class HttpsError extends Error {} }), { virtual: true });

import { ALCOHOL_COACH_NOTE, ALCOHOL_NUTRITION_NOTE } from '../lib/alcoholGuidance';
import { generateNutritionAdvice } from '../services/aiService';
import { buildCoachSystemPrompt } from '../services/coachService';
import { NUTRITION_EVIDENCE_NOTES } from '../functions/src/nutritionKnowledge';
import { SCOPE_POLICY, gateMessages } from '../functions/src/scope';

const NOW = new Date(2026, 9, 14, 9, 0);
const doc = fs.readFileSync(path.join(__dirname, '../functions/EXERCISE_SCIENCE_KNOWLEDGE.md'), 'utf8');
const alcoholLineOfCloudNotes = NUTRITION_EVIDENCE_NOTES.split('\n').find((line) => line.startsWith('- Alcohol:'));

describe('the Coach note', () => {
  const note = ALCOHOL_COACH_NOTE;

  it('gives the calorie and body facts from the sources', () => {
    for (const fact of [
      'about 7 calories a gram (second only to fat)',
      '12 oz beer, 5 oz wine or 1.5 oz spirits, 14 g of alcohol',
      'roughly 100-150 calories before mixers, which add more',
      'fills you up less than food, may raise hunger, slows the burning of dietary fat',
      'can disrupt sleep and blocks folate absorption',
    ]) expect(note).toContain(fact);
  });

  it('never has the Coach recommend drinking, and says why', () => {
    expect(note).toContain('known carcinogen');
    expect(note).toContain('the heart benefits seen in studies do not outweigh the harms');
    expect(note).toContain('never suggest drinking, or starting to drink, for health, fitness or recovery');
  });

  it('dates the 1 and 2 drink limits to the 2020-2025 Guidelines and says what the newer ones say', () => {
    expect(note).toContain('the 2020-2025 US Dietary Guidelines say not drinking is fine and, if drinking, at most 1 drink a day for women and 2 for men');
    expect(note).toContain('the 2025-2030 edition only says to consume less alcohol for better health');
    expect(note).toContain('Heavy drinking is more than 3 drinks a day for women and more than 4 for men');
  });

  it('sends the people who should not drink to a doctor', () => {
    expect(note).toContain('pregnant or trying to conceive');
    expect(note).toContain('in recovery from alcohol use disorder');
    expect(note).toContain('liver disease');
    expect(note).toContain('medication that interacts with alcohol');
    expect(note).toContain('say not to drink or to ask a doctor first');
    expect(note).toContain('if someone cannot cut down, suggest a doctor');
  });

  it('keeps the Coach from lecturing', () => {
    expect(note).toContain('raise it only when it bears on what they ask or log, and never lecture');
  });

  describe('on muscle, recovery and performance', () => {
    it('gives the heavy-drinking findings with their size', () => {
      for (const fact of [
        'a heavy night (roughly 6-10 drinks for an 80 kg person, 1-1.5 g of alcohol per kg) after hard training',
        'cut muscle protein synthesis by up to 37% in one small study of 8 men, and by about 24% even with whey protein',
        'heavy drinking also lowers testosterone for 12-24 hours, raises cortisol',
        'disrupts sleep and growth-hormone timing',
      ]) expect(note).toContain(fact);
    });

    it('says the evidence for lighter drinking is thin, and does not claim more than the sources show', () => {
      for (const fact of [
        'For lighter drinking the evidence is thin, so say so',
        'there are no human muscle-protein-synthesis data at low doses',
        'a review found about 0.5 g per kg (2-3 drinks for an 80 kg person) unlikely to affect recovery much',
        'large studies link only heavy drinking to lower muscle mass (3-6% lower in UK Biobank)',
        'light drinking is unlikely to matter much but is not proven harmless, and none is best for gains',
      ]) expect(note).toContain(fact);
    });

    it('does not pass on the articles\' own rules of thumb, which they do not source', () => {
      for (const rule of ['1-2 drinks', '4-6 drinks', '3-4 drinks', '1.5x', '1.5 times']) expect(note).not.toContain(rule);
      expect(note).not.toContain('36 hours');
    });

    it('gives the tips the articles share', () => {
      for (const tip of [
        'not before training or right after a hard session (rest days are better)',
        'eat about 25 g of protein and some carbohydrate first, which softens the hit but does not remove it',
        'alternate drinks with water',
        'count the calories, because drinking also raises how much people eat',
      ]) expect(note).toContain(tip);
    });
  });

  it('matches how the star rating treats drinks', () => {
    expect(note).toContain('beer, wine and cider to 2 stars at most; spirits and fortified wine to 1 star');
    expect(note).toContain('present that as nutrition, not a judgment of the person');
  });
});

describe('the Coach prompt', () => {
  const prompt = (user = { name: 'Sam', fitnessMetrics: {} }) => buildCoachSystemPrompt(user, NOW).content;

  it('carries the alcohol note, after the nutrition advice and before the instructions about creating things', () => {
    const text = prompt();
    expect(text).toContain(ALCOHOL_COACH_NOTE);
    expect(text.indexOf(ALCOHOL_COACH_NOTE)).toBeGreaterThan(text.indexOf('suggest a doctor or registered dietitian.'));
    expect(text.indexOf(ALCOHOL_COACH_NOTE)).toBeLessThan(text.indexOf('You can create things inside'));
  });

  it('carries it for every kind of profile, and is still one system message', () => {
    for (const user of [null, undefined, {}, { name: 'Sam', fitnessMetrics: { nutritionPreference: 'keto', targetGoals: ['lose_weight'] } }]) {
      const message = buildCoachSystemPrompt(user, NOW);
      expect(message.role).toBe('system');
      expect(message.content).toContain(ALCOHOL_COACH_NOTE);
    }
  });

  it('still names the goals and keeps the rest of what it said', () => {
    const text = prompt({ name: 'Sam', fitnessLevel: 'beginner', fitnessMetrics: { targetGoals: ['build_muscle'] } });
    expect(text).toContain("You are ZOWN's AI fitness coach, in an ongoing coaching conversation with Sam.");
    expect(text).toContain('Goals: Build Muscle.');
    expect(text).toContain('give evidence-based guidance and say plainly when the evidence for a diet is limited or mixed');
  });
});

describe('the nutrition advice request', () => {
  const asked = [];
  beforeEach(() => {
    asked.length = 0;
    global.__httpsCallable = jest.fn(() => async ({ messages }) => {
      asked.push(messages);
      return { data: { completion: 'Eat well.' } };
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('ends its instructions with the alcohol note, after the rule about the answer\'s length and layout', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80);
    const system = asked[0].find((m) => m.role === 'system').content;
    expect(system).toContain('Output 120-180 words, terse bullet-like lines.');
    expect(system).toContain('No preamble. ' + ALCOHOL_NUTRITION_NOTE);
    expect(system.endsWith(ALCOHOL_NUTRITION_NOTE)).toBe(true);
    expect(system.indexOf('Respect restrictions.')).toBeLessThan(system.indexOf(ALCOHOL_NUTRITION_NOTE));
  });

  it('still sends the person\'s goals as the user message', async () => {
    await generateNutritionAdvice(['lose fat'], 90, 80);
    const user = asked[0].find((m) => m.role === 'user').content;
    expect(user).toContain('Goals: lose fat.');
    expect(user).toContain('Provide precise, safe, practical guidance for today.');
    expect(user).not.toContain('Alcohol');
  });
});

describe('the nutrition advice note', () => {
  const note = ALCOHOL_NUTRITION_NOTE;

  it('keeps alcohol out of the advice and gives the facts and the limits', () => {
    expect(note).toContain('never suggest it as a food, drink or recovery aid');
    expect(note).toContain('about 7 calories a gram with little else in it');
    expect(note).toContain('roughly 100-150 calories before mixers');
    expect(note).toContain('fills you up less than food, slows the burning of dietary fat and can disrupt sleep');
    expect(note).toContain('count it in their calories');
    expect(note).toContain('at most 1 drink a day for women and 2 for men (2020-2025 US Dietary Guidelines; the 2025-2030 edition says to consume less alcohol)');
    expect(note).toContain('keep it away from training: heavy drinking after hard sessions lowers muscle protein synthesis, so eat protein and carbohydrate first');
    expect(note).toContain('pregnant or trying to conceive, in recovery from alcohol use disorder, or with liver disease or interacting medication, say to ask a doctor');
  });
});

describe('the cloud nutrition-targets notes', () => {
  it('have one alcohol line, among the other evidence', () => {
    expect(NUTRITION_EVIDENCE_NOTES.split('\n').filter((line) => line.startsWith('- Alcohol:'))).toHaveLength(1);
    expect(NUTRITION_EVIDENCE_NOTES).toContain('- Limits (WHO)');
    expect(NUTRITION_EVIDENCE_NOTES).toContain('- Prefer minimally processed foods.');
  });

  it('give the calories, keep drinks out of meal ideas, and date the limits', () => {
    const line = alcoholLineOfCloudNotes;
    expect(line).toContain('about 7 kcal a gram');
    expect(line).toContain('roughly 100-150 kcal before mixers');
    expect(line).toContain('fills you up less than food, slows the burning of dietary fat and can disrupt sleep');
    expect(line).toContain('Do not put alcoholic drinks in meal ideas or suggest them for health, fitness or recovery');
    expect(line).toContain('the 2020-2025 US Dietary Guidelines say not drinking is fine and, if drinking, at most 1 drink a day for women and 2 for men (the 2025-2030 edition says to consume less alcohol)');
    expect(line).toContain('drinks belong away from training, because heavy drinking after hard sessions lowers muscle protein synthesis');
    expect(line).toContain('pregnant or trying to conceive, in recovery from alcohol use disorder, or with liver disease or interacting medication should not drink, or should ask a doctor first');
  });
});

describe('the three notes agree', () => {
  const notes = { coach: ALCOHOL_COACH_NOTE, advice: ALCOHOL_NUTRITION_NOTE, cloud: alcoholLineOfCloudNotes };

  it('on the limits, and on which edition of the Guidelines they come from', () => {
    for (const [name, note] of Object.entries(notes)) {
      expect({ name, ok: /1 drink a day for women and 2 for men/.test(note) }).toEqual({ name, ok: true });
      expect({ name, ok: note.includes('2020-2025') }).toEqual({ name, ok: true });
      expect({ name, ok: note.includes('2025-2030') }).toEqual({ name, ok: true });
    }
  });

  it('on never recommending drink for health, fitness or recovery', () => {
    for (const [name, note] of Object.entries(notes)) {
      expect({ name, ok: /(never suggest|Do not put alcoholic drinks in meal ideas or suggest them for|never suggest it as a food, drink or recovery aid)/.test(note) }).toEqual({ name, ok: true });
    }
  });

  it('on who is sent to a doctor', () => {
    for (const [name, note] of Object.entries(notes)) {
      for (const group of ['pregnant or trying to conceive', 'in recovery from alcohol use disorder', 'liver disease']) {
        expect({ name, group, ok: note.includes(group) }).toEqual({ name, group, ok: true });
      }
    }
  });

  it('on keeping drinks away from training because of muscle protein synthesis', () => {
    for (const [name, note] of Object.entries(notes)) {
      expect({ name, ok: note.includes('muscle protein synthesis') }).toEqual({ name, ok: true });
      expect({ name, ok: /heavy (night|drinking)/.test(note) }).toEqual({ name, ok: true });
    }
  });

  it('on the calories', () => {
    for (const [name, note] of Object.entries(notes)) {
      expect({ name, ok: /about 7 (calories|kcal) a gram/.test(note) }).toEqual({ name, ok: true });
      expect({ name, ok: note.includes('100-150') }).toEqual({ name, ok: true });
    }
  });
});

describe('the topic check and scope rule', () => {
  it('name alcohol and health as in scope', () => {
    const gate = gateMessages([{ role: 'user', content: 'Is a beer after lifting bad for gains?' }])[0].content;
    expect(gate).toContain('alcohol and drinking as they affect training, sleep, weight, diet and health (calories in drinks, cutting down, hangovers, safe limits)');
    expect(SCOPE_POLICY).toContain('alcohol and drinking as they bear on health, training and diet');
  });

  it('still keep finance and the rest out of scope', () => {
    const gate = gateMessages([{ role: 'user', content: 'hi' }])[0].content;
    expect(gate).toContain('OUT of scope: personal finance, investing, crypto, taxes');
    expect(SCOPE_POLICY).toContain('Anything else, such as money, investing, taxes');
  });

  it('does not make the in-scope list a way round the out-of-scope one', () => {
    const gate = gateMessages([{ role: 'user', content: 'hi' }])[0].content;
    expect(gate).toContain('fitness words wrapped around an out-of-scope task are all out of scope');
  });
});

describe('the knowledge doc', () => {
  const section = doc.slice(doc.indexOf('### 8.1'), doc.indexOf('### 8.2'));
  const alcohol = section.slice(section.indexOf('- **Alcohol**'));

  it('has an alcohol entry in section 8.1 with its sources', () => {
    expect(alcohol.length).toBeGreaterThan(0);
    expect(alcohol).toContain('nutritionsource.hsph.harvard.edu/healthy-drinks/drinks-to-consume-in-moderation/alcohol-full-story/');
    expect(alcohol).toContain('healthline.com/nutrition/alcohol-good-or-bad');
    expect(alcohol).toContain('nutritionsource.hsph.harvard.edu/2026/01/09/dietary-guidelines-for-americans-2025-2030/');
  });

  it('holds every number the prompts use', () => {
    const flat = alcohol.replace(/\s+/g, ' ');
    for (const fact of [
      '12 oz beer, 5 oz wine or 1½ oz spirits', '14 g', '7 kcal a gram', '100-150 kcal',
      'the 2020-2025 Dietary Guidelines say not drinking is fine and, if drinking, 1 drink or less a day for women and 2 or less for men',
      'The 2025-2030 Guidelines say only "consume less alcohol for better health"',
      'heavy = more than 3 a day for women and more than 4 for men',
    ]) {
      expect({ fact, ok: flat.includes(fact) }).toEqual({ fact, ok: true });
    }
  });

  it('has the muscle, recovery and performance findings, their sources, and the gap in the evidence', () => {
    const flat = alcohol.replace(/\s+/g, ' ');
    for (const fact of [
      'scienceinsights.org/does-alcohol-ruin-gains-effects-on-muscle-growth/',
      'strengthlog.com/alcohol-and-muscle-growth/',
      'basicsofbodybuilding.com/the-influence-of-alcohol-on-muscle-growth-and-recovery/',
      'cut muscle protein synthesis by up to 37% and by 24% even with whey protein',
      'no human study has measured muscle protein synthesis at low doses',
      'in UK Biobank (about 200,000 people, 2023) heavy drinkers had 3-6% less muscle mass',
      'a 2014 *Sports Med* review judged that dose unlikely to affect recovery much',
      'eat about 25 g of protein and some carbohydrate first',
      'the prompts do not state them',
    ]) expect({ fact, ok: flat.includes(fact) }).toEqual({ fact, ok: true });
  });

  it('says plainly that the fourth article could not be read', () => {
    expect(doc).toContain("28. Men's Health UK");
    expect(doc).toContain('was not read or used');
    expect(alcohol).toContain("A fourth article, Men's Health UK, could not be opened by the tool and was not used.");
  });

  it('lists both pages in the sources and says where alcohol is wired in', () => {
    expect(doc).toContain('23. [Harvard Nutrition Source — Alcohol: balancing risks and benefits]');
    expect(doc).toContain('24. [Healthline — Alcohol and health]');
    expect(doc).toContain('25. [ScienceInsights');
    expect(doc).toContain('26. [Strengthlog');
    expect(doc).toContain('27. [Basics of Bodybuilding');
    expect(doc).toContain('The alcohol entry in §8.1 is wired in four places');
  });
});
