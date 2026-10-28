// The words around today's session (lib/sessionWording.js): what the AI is told, and the checks every answer passes before anyone sees it.
// The checks are tested against hand-built sessions (so each expected figure is visible here) and against sessions the real picker builds
// (the engine's own words must always pass its own checks).
import {
  WORDING_RULES, WORDING_CAPTION, WORDING_SYSTEM, wordingBrief, wordingMessages, wordingKey, parseWordingReply, checkWording, applyWording,
} from '../lib/sessionWording';
import { pickSession, attachTargets, sessionToWorkout, SESSION_RULES } from '../lib/sessionPicker';
import { MUSCLES } from '../lib/muscleVocabulary';

// A session as the picker builds it, with the figures written out: a bench press with a 60 kg target, a Romanian deadlift without one, and a plank.
const session = (over = {}) => ({
  status: 'ok', message: null, name: 'Chest and Hamstrings', goal: 'muscle', level: 'intermediate', minutes: 40, exactMinutes: 40.2, totalSets: 9,
  leftOutFor: [], tired: [],
  exercises: [
    {
      id: 'barbell-bench-press', name: 'Barbell Bench Press', sets: 3, role: 'compound', timed: false, bodyweight: false, repRange: { min: 8, max: 10 }, reps: '8-10',
      holdSeconds: null, restSeconds: 120, workSeconds: 45, weight: 60, unit: 'kg', target: '60 kg x 8-10', detail: 'Last time: 57.5 kg x 10',
      reason: "Chest: about 92% recovered, 6 sets short of this week's 14-set aim.", facts: { muscle: 'chest', recovered: 92, done: 8, short: 6, aim: 14 },
    },
    {
      id: 'romanian-deadlift', name: 'Romanian Deadlift', sets: 3, role: 'compound', timed: false, bodyweight: false, repRange: { min: 8, max: 10 }, reps: '8-10',
      holdSeconds: null, restSeconds: 120, workSeconds: 45, weight: null, unit: null, target: null, detail: null,
      reason: "Hamstrings: fully rested, 13 sets short of this week's 14-set aim.", facts: { muscle: 'hamstrings', recovered: 100, done: 1, short: 13, aim: 14 },
    },
    {
      id: 'plank', name: 'Plank', sets: 3, role: 'accessory', timed: true, bodyweight: true, repRange: null, reps: null,
      holdSeconds: 40, restSeconds: 45, workSeconds: 40, weight: null, unit: null, target: null, detail: null,
      reason: 'Core: fully rested, no sets logged this week (aim 14).', facts: { muscle: 'core', recovered: 100, done: 0, short: 14, aim: 14 },
    },
  ],
  ...over,
});
const withNote = () => session({ leftOutFor: ['shoulder'], tired: [{ muscle: 'quadriceps', recovered: 38 }, { muscle: 'calves', recovered: 55 }] });

// The reply still has a name in it here, as an AI that was not told to leave it out might send: it is ignored (see "a name in the reply").
const good = () => ({
  name: 'Chest and Hamstrings Day',
  note: 'Overhead work was left out because of your shoulder, and your quadriceps are only 38% recovered.',
  picks: [
    { id: 'barbell-bench-press', why: 'Your chest is 92% recovered and 6 sets short of its 14-set weekly aim, so 3 sets of 8-10 at 60 kg fit.' },
    { id: 'romanian-deadlift', why: 'Hamstrings are fully rested and 13 sets short of this week\'s aim, so this comes before the plank.' },
    { id: 'plank', why: 'Your core has no sets logged this week, against an aim of 14.' },
  ],
});

describe('the rules', () => {
  it('are these, and fixed', () => {
    expect(WORDING_RULES).toEqual({ version: 2, whyMin: 8, whyMax: 180, noteMax: 260, tiredListed: 3, delayMs: 1200 });
    expect(Object.isFrozen(WORDING_RULES)).toBe(true);
  });

  it('give a caption that says what the AI did and did not do', () => {
    expect(WORDING_CAPTION).toMatch(/worded by AI/);
    expect(WORDING_CAPTION).toMatch(/exercises, sets, reps and weights are the engine's/);
  });

  it('do not say the AI names the session, since the engine does', () => {
    expect(WORDING_CAPTION).not.toMatch(/name/i);
    expect(WORDING_SYSTEM).toMatch(/Do not name the session/);
    expect(WORDING_SYSTEM).not.toMatch(/"name"/);
    expect(WORDING_SYSTEM).not.toMatch(/short plain name/);
  });
});

describe('what the AI is told', () => {
  it('is the goal, level, time, equipment, unit, the injury areas left out, the tired muscles and, for each exercise, its figures', () => {
    const brief = wordingBrief(withNote(), { unit: 'kg', equipment: 'dumbbells' });
    expect(brief).toEqual({
      goal: 'Build Muscle', level: 'intermediate', minutes: 40, equipment: 'dumbbells and a bench', weightUnit: 'kg',
      injuryAreasLeftOut: ['shoulder'],
      tiredMuscles: [{ muscle: 'Quadriceps', recoveredPercent: 38 }, { muscle: 'Calves', recoveredPercent: 55 }],
      exercises: [
        {
          id: 'barbell-bench-press', name: 'Barbell Bench Press', sets: 3, reps: '8-10', holdSeconds: null, restSeconds: 120, weight: 60, target: '60 kg x 8-10',
          pickedFor: { muscle: 'Chest', recoveredPercent: 92, setsDoneThisWeek: 8, setsShortOfWeeklyAim: 6, weeklySetAim: 14 },
        },
        {
          id: 'romanian-deadlift', name: 'Romanian Deadlift', sets: 3, reps: '8-10', holdSeconds: null, restSeconds: 120, weight: null, target: null,
          pickedFor: { muscle: 'Hamstrings', recoveredPercent: 100, setsDoneThisWeek: 1, setsShortOfWeeklyAim: 13, weeklySetAim: 14 },
        },
        {
          id: 'plank', name: 'Plank', sets: 3, reps: null, holdSeconds: 40, restSeconds: 45, weight: null, target: null,
          pickedFor: { muscle: 'Core', recoveredPercent: 100, setsDoneThisWeek: 0, setsShortOfWeeklyAim: 14, weeklySetAim: 14 },
        },
      ],
    });
  });

  it('names the unit as kg or lb only, and leaves the equipment out when it is not one of the presets', () => {
    expect(wordingBrief(session(), { unit: 'lb' }).weightUnit).toBe('lb');
    ['stone', undefined, null, 'KG', 7].forEach((unit) => expect(wordingBrief(session(), { unit }).weightUnit).toBe('lb'));
    expect(wordingBrief(session(), { unit: 'kg', equipment: 'garage' }).equipment).toBeNull();
    expect(wordingBrief(session(), { unit: 'kg' }).equipment).toBeNull();
  });

  it('tells at most three tired muscles, and never a negative set count', () => {
    const tired = ['a', 'b', 'c', 'd', 'e'].map((m, i) => ({ muscle: 'chest', recovered: 10 + i }));
    expect(wordingBrief(session({ tired }), { unit: 'kg' }).tiredMuscles).toHaveLength(3);
    const s = session();
    s.exercises[0].facts.short = -2;
    expect(wordingBrief(s, { unit: 'kg' }).exercises[0].pickedFor.setsShortOfWeeklyAim).toBe(0);
  });

  it('says nothing about who the person is: no name, no email, no history, no one-rep max, no ids of people', () => {
    const text = JSON.stringify(wordingBrief(withNote(), { unit: 'kg', equipment: 'gym' }));
    expect(text).not.toMatch(/email|@|uid|oneRepMax|1rm|history|estimatedOneRepMax|detail|Last time|engineReason|reason/i);
    expect(Object.keys(wordingBrief(withNote(), { unit: 'kg' })).sort()).toEqual(
      ['equipment', 'exercises', 'goal', 'injuryAreasLeftOut', 'level', 'minutes', 'tiredMuscles', 'weightUnit'],
    );
    wordingBrief(withNote(), { unit: 'kg' }).exercises.forEach((x) => {
      expect(Object.keys(x).sort()).toEqual(['holdSeconds', 'id', 'name', 'pickedFor', 'reps', 'restSeconds', 'sets', 'target', 'weight']);
    });
  });

  it('leaves out what does not belong to the kind of exercise or is not a number', () => {
    const s = session();
    s.exercises[0] = { ...s.exercises[0], timed: false, holdSeconds: 99, weight: undefined, target: '' };
    s.exercises[2] = { ...s.exercises[2], timed: true, reps: '8-10', weight: 'heavy' };
    const [bench, , plank] = wordingBrief(s, { unit: 'kg' }).exercises;
    expect(bench).toMatchObject({ holdSeconds: null, weight: null, target: null, reps: '8-10' });
    expect(plank).toMatchObject({ reps: null, holdSeconds: 40, weight: null });
  });

  it('does not throw for something that is not a session', () => {
    [null, undefined, 'x', 7, [], {}].forEach((s) => {
      expect(() => wordingBrief(s, { unit: 'kg' })).not.toThrow();
      expect(wordingBrief(s, { unit: 'kg' }).exercises).toEqual([]);
    });
  });

  it('is sent as a system message with the instructions and a user message with the session as JSON', () => {
    const messages = wordingMessages(withNote(), { unit: 'kg', equipment: 'gym' });
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[0].content).toBe(WORDING_SYSTEM);
    expect(JSON.parse(messages[1].content)).toEqual(wordingBrief(withNote(), { unit: 'kg', equipment: 'gym' }));
  });

  it('gives the instructions that keep the AI to wording', () => {
    expect(WORDING_SYSTEM).toMatch(/do not choose, change, add, remove or reorder anything/);
    expect(WORDING_SYSTEM).toMatch(/JSON only/);
    expect(WORDING_SYSTEM).toMatch(/Never convert units/);
    expect(WORDING_SYSTEM).toMatch(/Name no other exercise/);
    expect(WORDING_SYSTEM).toMatch(/guaranteed, proven, safe, optimal, accurate, clinically or scientifically validated, or medical advice/);
    expect(WORDING_SYSTEM).toMatch(/do not diagnose, treat or give rehab advice/i);
    expect(WORDING_SYSTEM.length).toBeLessThan(2400);
  });

  it('stays small for the biggest session', () => {
    const big = pickSession({ level: 'advanced', goal: 'muscle', minutes: 120 });
    const text = wordingMessages(big, { unit: 'kg', equipment: 'gym' }).map((m) => m.content).join('');
    expect(big.exercises).toHaveLength(SESSION_RULES.maxExercises);
    expect(text.length).toBeLessThan(5200);
  });
});

describe('wordingKey', () => {
  it('is the same for the same session and changes with anything the words depend on', () => {
    const key = (s, o = { unit: 'kg', equipment: 'gym' }) => wordingKey(s, o);
    expect(key(session())).toBe(key(session()));
    const changed = [
      key(session(), { unit: 'lb', equipment: 'gym' }),
      key(session(), { unit: 'kg', equipment: 'dumbbells' }),
      key(session({ goal: 'strength' })),
      key(session({ level: 'advanced' })),
      key(session({ minutes: 45 })),
      key(session({ leftOutFor: ['knee'] })),
      key(session({ tired: [{ muscle: 'chest', recovered: 30 }] })),
    ];
    const s1 = session(); s1.exercises[0].sets = 4;
    const s2 = session(); s2.exercises[0].weight = 62.5;
    const s3 = session(); s3.exercises[1].facts.short = 12;
    const s4 = session(); s4.exercises.reverse();
    changed.push(key(s1), key(s2), key(s3), key(s4));
    expect(new Set([key(session()), ...changed]).size).toBe(changed.length + 1);
  });

  it('starts with the version of the instructions, so an answer kept for old ones is not used', () => {
    expect(wordingKey(session(), { unit: 'kg' }).startsWith(`${WORDING_RULES.version}|`)).toBe(true);
  });
});

describe('parseWordingReply', () => {
  const object = { name: 'Push Day', picks: [] };

  it('reads plain JSON, JSON in a code fence, and JSON with a few words around it', () => {
    expect(parseWordingReply(JSON.stringify(object))).toEqual(object);
    expect(parseWordingReply(`\`\`\`json\n${JSON.stringify(object)}\n\`\`\``)).toEqual(object);
    expect(parseWordingReply(`Here you go: ${JSON.stringify(object)} Enjoy!`)).toEqual(object);
  });

  it.each([[null], [undefined], [7], [{}], [[]], [''], ['no braces'], ['{not json}'], ['{"a": 1'], ['}{'], ['[1,2]'], ['{"a":1} {"b":2}']])('%p is nothing', (text) => {
    expect(parseWordingReply(text)).toBeNull();
  });

  it('is an object for an empty object, which has nothing in it to use', () => {
    expect(parseWordingReply('{}')).toEqual({});
  });
});

describe('checkWording: an answer that is right', () => {
  it('keeps the note and every reason', () => {
    const out = checkWording(good(), withNote(), { unit: 'kg' });
    expect(out).toEqual({
      note: good().note,
      why: Object.fromEntries(good().picks.map((p) => [p.id, p.why])),
    });
  });

  it('tidies the white space', () => {
    const reply = good();
    reply.picks[0].why = '  Your   chest\n is 92% recovered.  ';
    expect(checkWording(reply, withNote(), { unit: 'kg' }).why['barbell-bench-press']).toBe('Your chest is 92% recovered.');
  });

  it('accepts the figures the engine repeats for a pick', () => {
    const reply = good();
    reply.picks[0] = { ...reply.picks[0], sets: 3, reps: '8-10', restSeconds: 120, weight: 60 };
    reply.picks[1] = { ...reply.picks[1], weight: null };
    expect(checkWording(reply, withNote(), { unit: 'kg' }).why['barbell-bench-press']).toBe(good().picks[0].why);
  });

  it('does not need every exercise: the ones left out keep the engine\'s reason', () => {
    const reply = good();
    reply.picks = reply.picks.slice(1);
    const out = checkWording(reply, withNote(), { unit: 'kg' });
    expect(Object.keys(out.why)).toEqual(['romanian-deadlift', 'plank']);
  });

  it('does not need the note or the picks', () => {
    expect(checkWording({ picks: [{ id: 'plank', why: 'Your core has no sets logged this week.' }] }, session(), { unit: 'kg' }))
      .toEqual({ note: null, why: { plank: 'Your core has no sets logged this week.' } });
    expect(checkWording({ note: 'Overhead work was left out because of your shoulder.' }, withNote(), { unit: 'kg' }))
      .toEqual({ note: 'Overhead work was left out because of your shoulder.', why: {} });
  });

  it('is the same for pounds, with the pound name', () => {
    const lb = session();
    lb.exercises[0].weight = 135; lb.exercises[0].unit = 'lb'; lb.exercises[0].target = '135 lb x 8-10';
    const reply = { picks: [{ id: 'barbell-bench-press', why: 'Start at 135 lb for 8-10 reps, as your chest is 92% recovered.' }] };
    expect(checkWording(reply, lb, { unit: 'lb' }).why['barbell-bench-press']).toBe(reply.picks[0].why);
    ['Start at 135 kg for 8-10 reps.', 'Start at 135 kilos for 8-10 reps.', 'Start at 135 kilograms for 8-10 reps.', 'Start at 135 kgs for 8-10 reps.']
      .forEach((text) => expect(checkWording({ picks: [{ id: 'barbell-bench-press', why: text }] }, lb, { unit: 'lb' })).toBeNull());
    ['Start at 60 kg.', 'Start at 60 kilos.', 'Start at 60 kilograms.'].forEach((text) => {
      expect(checkWording({ picks: [{ id: 'barbell-bench-press', why: text }] }, session(), { unit: 'kg' }).why['barbell-bench-press']).toBe(text);
    });
    ['Start at 60 lb.', 'Start at 60 lbs.', 'Start at 60 pounds.'].forEach((text) => {
      expect(checkWording({ picks: [{ id: 'barbell-bench-press', why: text }] }, session(), { unit: 'kg' })).toBeNull();
    });
  });
});

describe('checkWording: an answer that cannot be used at all', () => {
  it.each([
    ['nothing', null], ['text', 'hello'], ['a list', []], ['a number', 7], ['nothing in it', {}],
    ['picks that are not a list', { name: 'Upper Day', picks: 'bench' }],
    ['picks that are an object', { name: 'Upper Day', picks: { id: 'plank' } }],
    ['a pick that is not an object', { name: 'Upper Day', picks: ['plank'] }],
    ['a pick with no id', { name: 'Upper Day', picks: [{ why: 'Your core has no sets logged this week.' }] }],
    ['an exercise that is not in the session', { name: 'Upper Day', picks: [{ id: 'barbell-back-squat', why: 'Your quadriceps are rested for this.' }] }],
    ['an id that is not in the library at all', { name: 'Upper Day', picks: [{ id: 'made-up-lift', why: 'Your core has no sets logged this week.' }] }],
    ['an id of the wrong type', { name: 'Upper Day', picks: [{ id: 7, why: 'Your core has no sets logged this week.' }] }],
    ['the same exercise twice', { name: 'Upper Day', picks: [{ id: 'plank', why: 'Your core has no sets logged this week.' }, { id: 'plank', why: 'Core work is due this week.' }] }],
    ['a different number of sets', { name: 'Upper Day', picks: [{ id: 'plank', sets: 4, why: 'Your core has no sets logged this week.' }] }],
    ['different reps', { name: 'Upper Day', picks: [{ id: 'barbell-bench-press', reps: '5-8', why: 'Your chest is 92% recovered.' }] }],
    ['a different rest', { name: 'Upper Day', picks: [{ id: 'barbell-bench-press', restSeconds: 90, why: 'Your chest is 92% recovered.' }] }],
    ['a different weight', { name: 'Upper Day', picks: [{ id: 'barbell-bench-press', weight: 65, why: 'Your chest is 92% recovered.' }] }],
    ['a weight for an exercise with none', { name: 'Upper Day', picks: [{ id: 'plank', weight: 10, why: 'Your core has no sets logged this week.' }] }],
  ])('%s', (_, reply) => {
    expect(checkWording(reply, withNote(), { unit: 'kg' })).toBeNull();
  });

  it('is nothing when one bad pick sits among good ones, since the answer is then about a different session', () => {
    const reply = good();
    reply.picks.push({ id: 'dumbbell-curl', why: 'Biceps are rested.' });
    expect(checkWording(reply, withNote(), { unit: 'kg' })).toBeNull();
  });

  it('is nothing when there is no session to check against', () => {
    [null, undefined, {}, { exercises: [] }, { exercises: 'x' }, 'x'].forEach((s) => expect(checkWording(good(), s, { unit: 'kg' })).toBeNull());
  });

  it('is nothing when every piece fails', () => {
    const reply = { note: 'ignored', picks: [{ id: 'plank', why: 'short' }] };
    expect(checkWording(reply, withNote(), { unit: 'kg' })).toBeNull();
  });
});

describe('checkWording: a reason that fails keeps the engine\'s, and the rest stand', () => {
  const why = (text, over = {}) => {
    const reply = { picks: [{ id: 'barbell-bench-press', why: text }, { id: 'plank', why: 'Your core has no sets logged this week.' }] };
    const out = checkWording(reply, session(), { unit: 'kg', ...over });
    return out && out.why['barbell-bench-press'] !== undefined ? out.why['barbell-bench-press'] : null;
  };

  it('keeps the other reasons when one fails', () => {
    const out = checkWording({ picks: [{ id: 'barbell-bench-press', why: 'This is guaranteed to build your chest.' }, { id: 'plank', why: 'Your core has no sets logged this week.' }] }, session(), { unit: 'kg' });
    expect(out.why).toEqual({ plank: 'Your core has no sets logged this week.' });
  });

  it('accepts every figure the engine gave for that pick, said any way round', () => {
    [
      'Your chest is 92% recovered.', 'It is 6 sets short of the 14-set aim.', 'You have done 8 sets this week.', 'Three sets of 8-10 reps.',
      'Rest 120 seconds between sets.', 'Start at 60 kg.', 'Aim for 60 kg x 8-10.', 'That is 3 sets, 8 to 10 reps, at 60 kg.',
      'Chest first, at 92%, as 6 sets are still missing from the 14.',
    ].forEach((text) => expect(why(text)).toBe(text.replace(/\s+/g, ' ')));
  });

  it.each([
    ['a number the engine did not give for it', 'Your chest is 91% recovered.'],
    ['a number that belongs to another pick', 'Your hamstrings are 100% recovered and 13 sets short.'],
    ['a number from the other week', 'You did 12 sets last week.'],
    ['a decimal that is not the weight', 'Start at 62.5 kg.'],
    ['a number word beside a unit that is not a figure', 'Do five sets.'],
    ['a number word for minutes', 'Rest two minutes between sets.'],
    ['a percent in words', 'Your chest is ninety percent recovered.'],
    ['the other unit', 'Start at 132 lb.'],
    ['the other unit written out', 'Start with the pounds shown.'],
    ['a guarantee', 'This is guaranteed to work.'],
    ['proven', 'A proven way to build your chest.'],
    ['clinically', 'Clinically backed.'],
    ['scientifically', 'Scientifically chosen for you.'],
    ['accurate', 'An accurate pick for your chest.'],
    ['diagnose', 'This will diagnose a weak chest.'],
    ['cure', 'This can cure a weak chest.'],
    ['treat', 'It will treat your weak chest.'],
    ['rehab', 'Good for rehab of the chest.'],
    ['therapy', 'A kind of therapy for the chest.'],
    ['medical advice', 'Not medical advice, but chest is due.'],
    ['safe', 'A safe choice for your chest.'],
    ['prevent', 'Helps prevent injury to your chest.'],
    ['optimal', 'The optimal pick today.'],
    ['perfect', 'A perfect session for your chest.'],
    ['a link', 'See https://example.com for form.'],
    ['a web address without a scheme', 'See www.example.com for form.'],
    ['a domain', 'Form tips at bench.com.'],
    ['an address', 'Ask me@example.org.'],
    ['a link with no known ending', 'See https://example/form for form.'],
    ['a web address with an ending that is not listed', 'See www.example.xyz for form.'],
    ['an address with no ending', 'Ask me@example about form.'],
    ['markdown bold', 'Your **chest** is rested.'],
    ['a heading', '# Chest is rested today'],
    ['markup', 'Your <b>chest</b> is rested.'],
    ['a code mark', 'Your `chest` is rested.'],
    ['a brace', 'Your {chest} is rested.'],
    ['another exercise from the library', 'Same as the Dumbbell Bench Press but heavier.'],
    ['another exercise written small', 'Better than a push-up for your chest.'],
    ['an exercise from the library that is in the plan only as part of another name', 'Do it before the deadlift.'],
    ['text that is not text', 7],
    ['nothing', ''],
    ['too short', 'Rested.'],
    ['too long', `Your chest is rested ${'and ready '.repeat(20)}today.`],
  ])('%s', (_, text) => {
    expect(why(text)).toBeNull();
  });

  it('allows the name of an exercise that is in the session, and does not read Romanian Deadlift as Deadlift', () => {
    const reply = { picks: [{ id: 'romanian-deadlift', why: 'The Romanian Deadlift goes before the Plank for your hamstrings.' }] };
    expect(checkWording(reply, session(), { unit: 'kg' }).why['romanian-deadlift']).toBe(reply.picks[0].why);
    expect(checkWording({ picks: [{ id: 'romanian-deadlift', why: 'A deadlift works your hamstrings.' }] }, session(), { unit: 'kg' })).toBeNull();
  });

  it('allows the words that only look like a claim in everyday use', () => {
    ['Your chest is rested, so the press comes first.', 'It adds sets where this week is short.'].forEach((text) => expect(why(text)).toBe(text));
  });

  it('allows at most 180 characters, at least 8', () => {
    const exactly = (n) => `${'Chest is rested. '.repeat(20)}`.slice(0, n).trim();
    expect(why(`${'a'.repeat(179)}.`)).toBe(`${'a'.repeat(179)}.`);
    expect(why(`${'a'.repeat(180)}.`)).toBeNull();
    expect(why('Chest up.')).toBe('Chest up.');
    expect(why('Chest.')).toBeNull();
    expect(exactly(10).length).toBeGreaterThan(0);
  });
});

describe('checkWording: a name in the reply', () => {
  const pick = { id: 'plank', why: 'Your core has no sets logged this week.' };

  it('is ignored: the session\'s name is the engine\'s (lib/workoutNames.js), never the AI\'s', () => {
    ['Upper Body', 'Trap Bar Deadlift Day', 'Romanian Deadlift Day', 'Dumbbell Bench Press Day', 'Day 3 Push', '**Chest** Day', 7, null, ['x']].forEach((name) => {
      const out = checkWording({ name, picks: [pick] }, session(), { unit: 'kg' });
      expect(out).toEqual({ note: null, why: { plank: pick.why } });
      expect(out).not.toHaveProperty('name');
    });
  });

  it('is not an answer by itself: a reply with a name and nothing else to use is nothing', () => {
    expect(checkWording({ name: 'Upper Body' }, session(), { unit: 'kg' })).toBeNull();
    expect(checkWording({ name: 'Upper Body', picks: [] }, session(), { unit: 'kg' })).toBeNull();
  });

  it('does not make a good reason or note fail, however odd it is', () => {
    const out = checkWording({ name: 'This is guaranteed to build your chest 100 times over', note: good().note, picks: [pick] }, withNote(), { unit: 'kg' });
    expect(out.note).toBe(good().note);
    expect(Object.keys(out.why)).toEqual(['plank']);
  });
});

describe('checkWording: the note', () => {
  const note = (text, s = withNote()) => {
    const out = checkWording({ note: text }, s, { unit: 'kg' });
    return out ? out.note : null;
  };

  it('is kept when there is an injury area left out or a tired muscle to mention', () => {
    expect(note('Overhead work was left out because of your shoulder.')).toBe('Overhead work was left out because of your shoulder.');
    expect(note('Your quadriceps are 38% recovered.', session({ tired: [{ muscle: 'quadriceps', recovered: 38 }] }))).toBe('Your quadriceps are 38% recovered.');
    expect(note('Overhead work was left out because of your knee.', session({ leftOutFor: ['knee'] }))).toBe('Overhead work was left out because of your knee.');
  });

  it('is dropped when there is nothing to mention, however harmless it sounds', () => {
    expect(note('Have a great session today.', session())).toBeNull();
    expect(note('Have a great session today.', session({ leftOutFor: [], tired: [] }))).toBeNull();
  });

  it('may quote the figures of the session: its minutes, sets, the tired muscles\' recovery and any pick\'s figures', () => {
    ['Your quadriceps are 38% recovered.', 'About 40 minutes and 9 sets, with calves at 55%.', 'Chest is 92% recovered.'].forEach((text) => expect(note(text)).toBe(text));
  });

  it.each([
    ['a number that is not in the session', 'Your quadriceps are 41% recovered.'],
    ['a claim', 'A safe session for your shoulder.'],
    ['a diagnosis', 'Your shoulder pain sounds like a rotator cuff tear, so this will treat it.'],
    ['rehab', 'This is a rehab session for your shoulder.'],
    ['the other unit', 'Use pounds for the shoulder work.'],
    ['a link', 'See https://example.com about your shoulder.'],
    ['an exercise outside the session', 'Try the Dumbbell Curl instead, for your shoulder.'],
    ['more than 260 characters', `Your shoulder was left out ${'and so on '.repeat(30)}.`],
    ['not text', 7],
    ['too short', 'Knee out.'.slice(0, 7)],
    ['empty', ''],
  ])('is dropped for %s', (_, text) => {
    expect(note(text)).toBeNull();
  });
});

describe('checkWording: where each figure comes from', () => {
  // One exercise whose every figure is different, so a figure that is not allowed is told apart from one that is.
  const odd = (extra = {}, factsExtra = {}) => ({
    status: 'ok', name: 'Day', goal: 'muscle', level: 'intermediate', minutes: 47, totalSets: 13, leftOutFor: [], tired: [],
    exercises: [
      {
        id: 'barbell-bench-press', name: 'Barbell Bench Press', sets: 4, timed: false, repRange: { min: 6, max: 8 }, reps: '6-8', holdSeconds: null, restSeconds: 150,
        weight: 72.5, target: '72.5 kg x 6-8', reason: 'r', facts: { muscle: 'chest', recovered: 87, done: 11, short: 3, aim: 14, ...factsExtra }, ...extra,
      },
      { id: 'plank', name: 'Plank', sets: 5, timed: true, repRange: null, reps: null, holdSeconds: 35, restSeconds: 50, weight: null, target: null, reason: 'r', facts: null },
      { id: 'deadlift', name: 'Deadlift', sets: 4, timed: false, repRange: { min: 5, max: 5 }, reps: '5-5', holdSeconds: null, restSeconds: 150, weight: null, target: null, reason: 'r', facts: null },
    ],
  });
  const passes = (text, s = odd(), id = 'barbell-bench-press') => {
    const out = checkWording({ picks: [{ id, why: text }] }, s, { unit: 'kg' });
    return !!out && out.why[id] === text;
  };

  it.each([
    ['its sets', 'Do 4 sets.'], ['its rest', 'Rest 150 seconds.'], ['its low rep', 'Start with 6 reps.'], ['its high rep', 'Up to 8 reps.'],
    ['its weight', 'Load 72.5 kg.'], ['how recovered the muscle is', 'It is 87% recovered.'], ['the sets done this week', 'You did 11 sets this week.'],
    ['the sets it is short', 'It is 3 sets short.'], ['the weekly aim', 'The aim is 14 sets.'],
  ])('allows %s', (_, text) => {
    expect(passes(text)).toBe(true);
  });

  it.each([
    ['a figure of another exercise (its hold)', 'Hold for 35 seconds.'], ['a figure of another exercise (its sets)', 'Do 5 sets.'], ['the minutes of the session', 'It takes 47 minutes.'],
    ['the total sets of the session', 'There are 13 sets in all.'], ['a whole number next to the decimal weight', 'Load 72 kg.'], ['the decimal cut short', 'Load 72.4 kg.'],
  ])('does not allow %s in a reason', (_, text) => {
    expect(passes(text)).toBe(false);
  });

  it('takes the reps from the rep range when the reps text is missing, and from the reps text when the rep range is', () => {
    expect(passes('Start with 6 reps.', odd({ reps: null, target: null }))).toBe(true);
    expect(passes('Start with 6 reps.', odd({ repRange: null, target: null }))).toBe(true);
    expect(passes('Start with 6 reps.', odd({ reps: null, repRange: null, target: null }))).toBe(false);
  });

  it('takes the weight from the weight when the target text is missing, and from the target text when the weight is', () => {
    expect(passes('Load 72.5 kg.', odd({ target: null }))).toBe(true);
    expect(passes('Load 72.5 kg.', odd({ weight: null }))).toBe(true);
    expect(passes('Load 72.5 kg.', odd({ weight: null, target: null }))).toBe(false);
    expect(passes('Load 47.5 kg for 9 reps.', odd({ weight: null, repRange: null, reps: null, target: '47.5 kg x 9' }))).toBe(true);
  });

  it('takes the hold from a timed exercise only', () => {
    expect(passes('Hold for 35 seconds.', odd(), 'plank')).toBe(true);
    expect(passes('Hold for 99 seconds.', odd({}), 'plank')).toBe(false);
    const stray = odd();
    stray.exercises[2].holdSeconds = 99;
    expect(passes('Hold for 99 seconds.', stray, 'deadlift')).toBe(false);
    stray.exercises[1].repRange = { min: 12, max: 15 };
    stray.exercises[1].reps = '12-15';
    expect(passes('Do 12 reps.', stray, 'plank')).toBe(false);
  });

  it('allows a weight that is a rounded-off decimal in the session', () => {
    const decimals = odd({ weight: 22.400000000000002, target: null });
    expect(passes('Load 22.4 kg.', decimals)).toBe(true);
  });

  it('allows 0 where the muscle is not short, even if the engine counted it as less than 0', () => {
    expect(passes('It is 0 sets short.', odd({}, { short: -2 }))).toBe(true);
    expect(passes('It is 2 sets short.', odd({}, { short: -2 }))).toBe(false);
  });

  it('lets the note quote the minutes, the total sets, the number of exercises, the tired muscles and any pick\'s figures, and nothing else', () => {
    const s = odd({}, { short: 2 });
    s.leftOutFor = ['shoulder'];
    s.tired = [{ muscle: 'calves', recovered: 29 }];
    const note = (text) => { const out = checkWording({ note: text }, s, { unit: 'kg' }); return out ? out.note : null; };
    ['About 47 minutes.', 'There are 13 sets in all.', 'Three exercises, with the shoulder left out.'.replace('Three', '3'), 'Your calves are 29% recovered.', 'The press is 87% recovered.']
      .forEach((text) => expect(note(text)).toBe(text));
    ['That is 48 minutes.', 'Your calves are 30% recovered.', 'There are 9 exercises.'].forEach((text) => expect(note(text)).toBeNull());
  });

  it('keeps a note that is the only thing that passed', () => {
    const s = odd();
    s.leftOutFor = ['shoulder'];
    expect(checkWording({ note: 'Overhead work was left out for your shoulder.', picks: [{ id: 'plank', why: 'no' }] }, s, { unit: 'kg' }))
      .toEqual({ note: 'Overhead work was left out for your shoulder.', why: {} });
  });

  it('accepts a weight of none for an exercise whose weight was never set', () => {
    const s = odd();
    delete s.exercises[2].weight;
    expect(checkWording({ picks: [{ id: 'deadlift', weight: null, why: 'Deadlift is due this week.' }] }, s, { unit: 'kg' }).why.deadlift).toBe('Deadlift is due this week.');
  });
});

describe('applyWording', () => {
  const wording = () => checkWording(good(), withNote(), { unit: 'kg' });

  it('puts the checked note and reasons on the session and keeps the engine\'s in their place of record', () => {
    const base = withNote();
    const out = applyWording(base, wording());
    expect(out.worded).toBe(true);
    expect(out.name).toBe('Chest and Hamstrings');
    expect(out).not.toHaveProperty('engineName');
    expect(out.note).toBe(good().note);
    expect(out.exercises.map((x) => x.reason)).toEqual(good().picks.map((p) => p.why));
    expect(out.exercises.map((x) => x.engineReason)).toEqual(base.exercises.map((x) => x.reason));
  });

  it('changes nothing but the words: the exercises, their order, sets, reps, rests and weights stay the engine\'s', () => {
    const base = withNote();
    const out = applyWording(base, wording());
    const strip = (s) => s.exercises.map(({ reason, engineReason, ...rest }) => rest);
    expect(strip(out)).toEqual(strip(base));
    const { note, worded, exercises, ...rest } = out;
    const { exercises: e2, ...rest2 } = base;
    expect(rest).toEqual(rest2);
  });

  it('does not change the session it was given', () => {
    const base = withNote();
    const before = JSON.stringify(base);
    applyWording(base, wording());
    expect(JSON.stringify(base)).toBe(before);
  });

  it('replaces only the reasons that passed', () => {
    const out = applyWording(session(), { note: null, why: { plank: 'Your core has no sets logged this week.' } });
    expect(out.exercises[2].reason).toBe('Your core has no sets logged this week.');
    expect(out.exercises[0].reason).toBe(session().exercises[0].reason);
    expect(out.exercises[0]).toBe(out.exercises[0]);
    expect(out.name).toBe('Chest and Hamstrings');
    expect(out.worded).toBe(true);
  });

  it('is the session itself with no wording, or with wording that changes nothing', () => {
    const base = session();
    [null, undefined, 'x', 7, [], {}, { note: null, why: {} }].forEach((w) => expect(applyWording(base, w)).toBe(base));
  });

  it('counts a note alone as wording, and ignores a note that is not text', () => {
    const base = session();
    const noted = applyWording(base, { note: 'Overhead work was left out for your shoulder.', why: {} });
    expect(noted.worded).toBe(true);
    expect(noted.note).toBe('Overhead work was left out for your shoulder.');
    expect(noted.name).toBe(base.name);
    expect(applyWording(base, { note: 7, why: {} })).toBe(base);
    expect(applyWording(base, { note: { a: 1 }, why: { plank: 7 } })).toBe(base);
  });

  it('never changes the session\'s name or title, even for wording that carries a name', () => {
    const base = session({ title: 'Quad Squad' });
    const out = applyWording(base, { name: 'Trap Bar Deadlift Day', note: null, why: { plank: 'Your core has no sets logged this week.' } });
    expect(out.name).toBe('Chest and Hamstrings');
    expect(out.title).toBe('Quad Squad');
    expect(applyWording(base, { name: 'Trap Bar Deadlift Day', note: null, why: {} })).toBe(base);
  });

  it('is what it was given for something that is not a session', () => {
    [null, undefined, 'x', {}, { exercises: 'x' }].forEach((s) => expect(applyWording(s, wording())).toBe(s));
  });

  it('is saved as a workout with the engine\'s made-up name, and with the same exercises as without it', () => {
    const picked = pickSession({ level: 'intermediate', goal: 'muscle', minutes: 45, equipment: 'gym' });
    const reply = { name: 'Big Compound Day', picks: picked.exercises.map((x) => ({ id: x.id, why: x.reason })) };
    const out = applyWording(picked, checkWording(reply, picked, { unit: 'lb' }));
    const plain = sessionToWorkout(picked);
    const worded = sessionToWorkout(out);
    expect(worded.name).toBe(picked.title);
    expect(worded.name).not.toBe('Big Compound Day');
    expect(worded.exercises).toEqual(plain.exercises);
    expect(worded).toEqual(plain);
  });
});

describe('the engine\'s own words pass its own checks', () => {
  const tiredExcept = (...ready) => Object.fromEntries(MUSCLES.filter((m) => !ready.includes(m)).map((m) => [m, 20]));
  const volumes = [
    undefined,
    { thisWeek: { chest: 8, lats: 3.4, quadriceps: 12 }, lastWeek: { chest: 10, lats: 10, quadriceps: 10 }, sessions: { chest: 1 } },
    { thisWeek: { chest: 14, lats: 14, shoulders: 14, quadriceps: 14 }, lastWeek: { chest: 14, lats: 14, shoulders: 14, quadriceps: 14 }, sessions: { chest: 2 } },
  ];
  const recoveries = [undefined, { chest: 92, lats: 85 }, tiredExcept('chest', 'shoulders', 'triceps'), tiredExcept('glutes', 'hamstrings', 'lower_back')];

  it('for every level, goal, time, recovery and week, whatever the picker writes is accepted when the AI repeats it', () => {
    let checked = 0;
    ['beginner', 'intermediate', 'advanced'].forEach((level) => ['strength', 'muscle', 'general'].forEach((goal) => [15, 30, 45, 60].forEach((minutes) => {
      recoveries.forEach((recovery) => volumes.forEach((volume) => {
        const s = pickSession({ level, goal, minutes, recovery, volume, injuries: level === 'advanced' ? ['shoulder'] : [] });
        if (s.status !== 'ok') return;
        const reply = { picks: s.exercises.map((x) => ({ id: x.id, why: x.reason, sets: x.sets, reps: x.reps, restSeconds: x.restSeconds })) };
        const out = checkWording(reply, s, { unit: 'lb' });
        expect(out).not.toBeNull();
        expect(Object.keys(out.why)).toEqual(s.exercises.map((x) => x.id));
        checked += 1;
      }));
    })));
    expect(checked).toBeGreaterThan(100);
  });

  it('and so does a session with its targets on, in either unit', () => {
    const s = pickSession({ level: 'intermediate', goal: 'strength', minutes: 45 });
    ['kg', 'lb'].forEach((unit) => {
      const prescriptions = Object.fromEntries(s.exercises.filter((x) => !x.timed && !x.bodyweight).map((x) => [x.id, {
        weight: unit === 'kg' ? 62.5 : 135, targetReps: 8, repRange: { min: 6, max: 8 }, dayType: 'heavy', deload: false, reason: 'r', estimatedOneRepMax: 100, shareOfOneRepMax: 80,
      }]));
      const withTargets = attachTargets(s, prescriptions, { unit });
      const lifted = withTargets.exercises.find((x) => x.weight !== null);
      expect(lifted).toBeDefined();
      const reply = { picks: [{ id: lifted.id, why: `Start at ${lifted.weight} ${unit} for ${lifted.reps} reps.` }] };
      expect(checkWording(reply, withTargets, { unit }).why[lifted.id]).toBe(reply.picks[0].why);
      const other = unit === 'kg' ? 'lb' : 'kg';
      expect(checkWording({ picks: [{ id: lifted.id, why: `Start at ${lifted.weight} ${other} for ${lifted.reps} reps.` }] }, withTargets, { unit })).toBeNull();
    });
  });
});
