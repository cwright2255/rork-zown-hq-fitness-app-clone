// The daily Today brief, the pure part (lib/todayBrief.js): the key it is kept under, checking the AI's answer, and the facts it is given.
import {
  BRIEF_STORAGE_KEY, BRIEF_MAX_POINTS, BRIEF_HEADLINE_MAX, BRIEF_POINT_MAX, BRIEF_SYSTEM_PROMPT, BRIEF_REQUEST,
  briefKey, parseBrief, serializeBrief, readinessFact, trendFacts, dateFact, buildBriefMessages,
} from '../lib/todayBrief';
import { computeReadiness } from '../lib/readiness';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);
const NOW = new Date(2026, 9, 20, 7, 30); // Tuesday 20 October 2026, 7:30 AM in the person's own time

describe('the numbers', () => {
  it('are these, and no others', () => {
    expect(BRIEF_STORAGE_KEY).toBe('zown-brief-cache');
    expect(BRIEF_MAX_POINTS).toBe(4);
    expect(BRIEF_HEADLINE_MAX).toBe(120);
    expect(BRIEF_POINT_MAX).toBe(240);
  });
});

describe('briefKey', () => {
  it('is one key for one person on one day', () => {
    expect(briefKey('u1', '2026-10-20')).toBe('brief|u1|2026-10-20');
    expect(briefKey('u1', '2026-10-20')).not.toBe(briefKey('u2', '2026-10-20'));
    expect(briefKey('u1', '2026-10-20')).not.toBe(briefKey('u1', '2026-10-21'));
  });

  it.each([[undefined, '2026-10-20'], [null, '2026-10-20'], ['', '2026-10-20'], [7, '2026-10-20'], ['u1', ''], ['u1', null], ['u1', undefined], ['u1', 20261020]])(
    'is nothing for %p and %p', (uid, when) => { expect(briefKey(uid, when)).toBeNull(); },
  );
});

describe('parseBrief', () => {
  const ok = { headline: 'A steady day', points: ['Train as planned.', 'Eat protein at lunch.'] };

  it('reads the JSON the AI was asked for', () => {
    expect(parseBrief(JSON.stringify(ok))).toEqual(ok);
  });

  it('finds the JSON inside a few extra words or a code fence', () => {
    expect(parseBrief(`Here you go: ${JSON.stringify(ok)} Enjoy!`)).toEqual(ok);
    expect(parseBrief('```json\n' + JSON.stringify(ok) + '\n```')).toEqual(ok);
  });

  it('trims the words, drops points that are empty or not words, and keeps at most four', () => {
    const text = JSON.stringify({
      headline: '  Easy day  ',
      points: ['  one  ', '', '   ', 7, null, 'two', 'three', 'four', 'five', 'six'],
    });
    expect(parseBrief(text)).toEqual({ headline: 'Easy day', points: ['one', 'two', 'three', 'four'] });
  });

  it('cuts text that is too long instead of keeping it whole', () => {
    const long = 'x'.repeat(500);
    const brief = parseBrief(JSON.stringify({ headline: long, points: [long] }));
    expect(brief.headline).toHaveLength(BRIEF_HEADLINE_MAX);
    expect(brief.points[0]).toHaveLength(BRIEF_POINT_MAX);
  });

  it('does not leave a space at the end of text that was cut', () => {
    const headline = `${'h'.repeat(BRIEF_HEADLINE_MAX - 1)} ${'z'.repeat(20)}`;
    const point = `${'p'.repeat(BRIEF_POINT_MAX - 1)} ${'z'.repeat(20)}`;
    const brief = parseBrief(JSON.stringify({ headline, points: [point] }));
    expect(brief.headline).toBe('h'.repeat(BRIEF_HEADLINE_MAX - 1));
    expect(brief.points[0]).toBe('p'.repeat(BRIEF_POINT_MAX - 1));
  });

  it('measures text from its first word, not from the spaces before it', () => {
    const brief = parseBrief(JSON.stringify({ headline: `   ${'h'.repeat(300)}`, points: [`   ${'p'.repeat(500)}`] }));
    expect(brief.headline).toHaveLength(BRIEF_HEADLINE_MAX);
    expect(brief.points[0]).toHaveLength(BRIEF_POINT_MAX);
  });

  it('needs a headline and at least one point', () => {
    expect(parseBrief(JSON.stringify({ points: ['a'] }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: '  ', points: ['a'] }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: 5, points: ['a'] }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: 'h' }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: 'h', points: [] }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: 'h', points: ['', ' '] }))).toBeNull();
    expect(parseBrief(JSON.stringify({ headline: 'h', points: 'one point' }))).toBeNull();
  });

  it.each([[null], [undefined], [5], [{}], [''], ['no braces here'], ['} backwards {'], ['{not json}'], ['{"headline": "h", "points": ["a"]']])(
    'is nothing for %p', (text) => { expect(parseBrief(text)).toBeNull(); },
  );

  it('gives back what serializeBrief kept', () => {
    expect(parseBrief(serializeBrief(ok))).toEqual(ok);
    expect(serializeBrief({ ...ok, extra: 'left out' })).toBe(JSON.stringify(ok));
  });
});

describe('the instructions', () => {
  it('ask for strict JSON in the shape parseBrief reads', () => {
    expect(BRIEF_SYSTEM_PROMPT).toContain('Respond with strict JSON only: {"headline": string, "points": string[]}.');
    expect(BRIEF_SYSTEM_PROMPT).toContain('at most 12 words');
    expect(BRIEF_SYSTEM_PROMPT).toContain('2 to 4 points');
  });

  it('tell the AI to use only what is listed, respect injuries and allergies, and not give medical advice', () => {
    expect(BRIEF_SYSTEM_PROMPT).toContain('Use only the numbers, names and facts listed there. Never invent a reading, a workout, a cause or a diagnosis');
    expect(BRIEF_SYSTEM_PROMPT).toContain('never suggest loading an injured area or a food they must avoid');
    expect(BRIEF_SYSTEM_PROMPT).toContain('not medical advice');
    expect(BRIEF_SYSTEM_PROMPT).toContain('never shame food, weight or a missed day');
    expect(BRIEF_SYSTEM_PROMPT).toContain('Mention a calendar item only if one is listed');
  });
});

describe('readinessFact', () => {
  const history = {};
  for (let i = 1; i <= 28; i += 1) history[day(-i)] = { hrv: 50, restingHeartRate: 60 };
  history[TODAY] = { hrv: 55, restingHeartRate: 57, sleepHours: 7 };
  const readiness = computeReadiness({ history, today: TODAY, trainingLoad: { zone: 'sweet_spot', ratio: 1 } });

  it('gives the score, its word and what each part was', () => {
    expect(readinessFact(readiness)).toBe(
      'Readiness today, worked out in the app from their own readings: 94 out of 100 (High). '
      + 'HRV: 55 ms today, 50 ms usual (+10%); Resting heart rate: 57 bpm today, 60 bpm usual (-5%); '
      + 'Sleep: 7.0 h last night (8 h scores 100); Training load: 1.00 this week against your usual week.',
    );
  });

  it('leaves out a part that had no reading, so nothing about waiting or missing history is passed on as a fact', () => {
    const early = computeReadiness({ history: { ...history, [TODAY]: { hrv: 55, restingHeartRate: 57, sleepHours: 7 } }, today: TODAY, trainingLoad: null });
    const fact = readinessFact(early);
    expect(fact).toContain('Sleep: 7.0 h last night');
    expect(fact).not.toContain('Training load');
    expect(fact).not.toContain('Needs about');
    const noRhr = computeReadiness({ history: { ...history, [TODAY]: { hrv: 55, sleepHours: 7 } }, today: TODAY });
    expect(readinessFact(noRhr)).not.toContain('Waiting');
    expect(readinessFact(noRhr)).not.toContain('Resting heart rate');
  });

  it('says nothing without a score, rather than something about being unable to tell', () => {
    expect(readinessFact(computeReadiness({ history: { [TODAY]: { sleepHours: 7 } }, today: TODAY }))).toBeNull();
    expect(readinessFact(null)).toBeNull();
    expect(readinessFact(undefined)).toBeNull();
    expect(readinessFact({ ready: true, score: null, parts: [] })).toBeNull();
  });
});

describe('trendFacts', () => {
  const history = {
    [day(0)]: { sleepHours: 7.0, hrv: 50, restingHeartRate: 60 },
    [day(-1)]: { sleepHours: 7.4, hrv: 54, restingHeartRate: 58 },
    [day(-2)]: { sleepHours: 7.2, hrv: 52, restingHeartRate: 59 },
    [day(-8)]: { sleepHours: 6.0, hrv: 40, restingHeartRate: 64 },
    [day(-9)]: { sleepHours: 6.2, hrv: 42, restingHeartRate: 62 },
    [day(-10)]: { sleepHours: 6.4, hrv: 44, restingHeartRate: 63 },
  };
  const kg = (offset, weightKg) => ({ id: `w${offset}`, weightKg, createdAtLocal: new Date(2026, 9, 20 + offset, 8).toISOString() });

  it('compares the last 7 days with the 7 before for sleep, HRV, resting heart rate and weight', () => {
    const facts = trendFacts({ history, weightLogs: [kg(-1, 80)], today: TODAY });
    expect(facts).toEqual([
      'Last 7 days: sleep 7.2 h on average over 3 of 7 days (+1.0 h against the 7 days before); '
      + 'HRV 52 ms on average over 3 of 7 days (+10 ms against the 7 days before); '
      + 'resting heart rate 59 bpm on average over 3 of 7 days (-4 bpm against the 7 days before); '
      + 'weight 176.4 lb on average over 1 of 7 days.',
    ]);
  });

  it('gives weight in kilograms when asked, and names the kind of HRV it is given', () => {
    const facts = trendFacts({ history: {}, weightLogs: [kg(0, 80)], pounds: false, today: TODAY });
    expect(facts[0]).toBe('Last 7 days: weight 80.0 kg on average over 1 of 7 days.');
    expect(trendFacts({ history, hrvLabel: 'HRV (SDNN)', today: TODAY })[0]).toContain('HRV (SDNN) 52 ms');
  });

  it('leaves out a reading that has none in the week, and says nothing with nothing', () => {
    const facts = trendFacts({ history: { [day(0)]: { hrv: 50 } }, weightLogs: [], today: TODAY });
    expect(facts).toEqual(['Last 7 days: HRV 50 ms on average over 1 of 7 days.']);
    expect(trendFacts({ history: {}, weightLogs: [], today: TODAY })).toEqual([]);
    expect(trendFacts()).toEqual([]);
    expect(trendFacts({ history: { [day(-9)]: { hrv: 50 } }, today: TODAY })).toEqual([]);
  });
});

describe('dateFact', () => {
  it('names the day in the person\'s own time', () => {
    expect(dateFact(NOW)).toBe('Today is Tuesday, October 20, 2026.');
    expect(dateFact(new Date(2026, 9, 20, 23, 59))).toBe('Today is Tuesday, October 20, 2026.');
  });
});

describe('buildBriefMessages', () => {
  const snapshot = { role: 'system', content: 'More about this user: Body: weight 176 lb.' };
  const dataMessage = { role: 'system', content: 'Here is this user\'s real, current logged data.' };

  it('is the instructions, the facts, the Coach\'s snapshot and data, then the request', () => {
    const messages = buildBriefMessages({
      now: NOW, name: 'Cj', profileLines: ['Fitness level: intermediate.', 'Goals: Build Muscle.'],
      readiness: null, trends: ['Last 7 days: HRV 50 ms on average over 1 of 7 days.'], snapshot, dataMessage,
    });
    expect(messages).toEqual([
      { role: 'system', content: BRIEF_SYSTEM_PROMPT },
      {
        role: 'system',
        content: 'About this person and today: Today is Tuesday, October 20, 2026. The person\'s name is Cj. Fitness level: intermediate. '
          + 'Goals: Build Muscle. Last 7 days: HRV 50 ms on average over 1 of 7 days.',
      },
      { role: 'system', content: snapshot.content },
      { role: 'system', content: dataMessage.content },
      { role: 'user', content: BRIEF_REQUEST },
    ]);
  });

  it('asks in fitness words, so the server\'s topic check does not take it for a writing task', () => {
    expect(BRIEF_REQUEST).toBe('Write my Today brief: a short note about my training, recovery and nutrition for today.');
  });

  it('leaves out the snapshot and the data when there are none, and the name when there is none', () => {
    const messages = buildBriefMessages({ now: NOW });
    expect(messages).toHaveLength(3);
    expect(messages[1].content).toBe('About this person and today: Today is Tuesday, October 20, 2026.');
    expect(messages[2]).toEqual({ role: 'user', content: BRIEF_REQUEST });
    expect(buildBriefMessages({ now: NOW, snapshot: { role: 'system', content: '' }, dataMessage: {} })).toHaveLength(3);
  });

  it('includes readiness when there is a score', () => {
    const history = {};
    for (let i = 1; i <= 28; i += 1) history[day(-i)] = { hrv: 50, restingHeartRate: 60 };
    history[TODAY] = { hrv: 50, restingHeartRate: 60, sleepHours: 8 };
    const readiness = computeReadiness({ history, today: TODAY });
    expect(buildBriefMessages({ now: NOW, readiness })[1].content).toContain('Readiness today, worked out in the app from their own readings: 82 out of 100 (High).');
  });
});
