// Where the AI's wording of Today's Session (lib/sessionWording.js, services/sessionWordingService.js) is hooked in. The screen is not rendered
// here, so the hookups are read from the source, the way sessionWiring.test.js reads the rest of the session's. The checks themselves are tested
// in sessionWording.test.js, the request in sessionWordingAi.test.js and the keeping in sessionWordingService.test.js; what the phone shows is
// checked on the phone (docs/DEVICE_CHECKS.md, "Today's Session").
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const importsOf = (src) => [...src.matchAll(/^import [^;]*? from '([^']+)';$/gm)].map((m) => m[1]).sort();
const lib = read('lib/sessionWording.js');
const service = read('services/sessionWordingService.js');
const screen = read('app/workout/session.jsx');
const ai = read('services/aiService.js');
const workouts = read('app/workouts.jsx');
const picker = read('lib/sessionPicker.js');
const sessionService = read('services/sessionService.js');

describe('the wording module', () => {
  it('reads no store, no Firestore and no screen: only the exercise library and the muscle names', () => {
    expect(importsOf(lib)).toEqual(['./exerciseLibrary', './homeWidgetData']);
    expect(lib).not.toMatch(/require\(|firebase|AsyncStorage|react|fetch\(/);
  });

  it('says, at the top, that the AI only puts words on the engine\'s session and that every answer is checked', () => {
    const words = lib.slice(0, 2600).replace(/\n\/\/ ?/g, ' ');
    expect(words).toMatch(/none of that is ever handed to the AI to decide/);
    expect(words).toMatch(/checked here before anyone sees it/);
    expect(words).toMatch(/No name, no email, no history, no one-rep maxes/);
  });
});

describe('the wording service', () => {
  it('takes the AI call and the checks, and nothing else: no store, no Firestore', () => {
    expect(importsOf(service)).toEqual(['@/lib/sessionWording', '@/services/aiService']);
    expect(service).not.toMatch(/require\(|firebase|AsyncStorage|useUserStore|useWorkoutStore/);
  });

  it('returns only what checkWording passed', () => {
    expect(service).toMatch(/wording = checkWording\(reply, session, \{ unit \}\);/);
    expect(service).not.toMatch(/return reply/);
  });
});

describe('the AI call', () => {
  it('is one try, as the insight kind that is open to every plan, and reads the reply as JSON only', () => {
    expect(ai).toMatch(/const data = await postLLM\(messages, 25000, 0, 'insight'\);/);
    expect(ai).toMatch(/return parseWordingReply\(data\.completion\);/);
    expect(ai).toMatch(/if \(data\?\.refused\) return null;/);
  });

  it('is the only change to the cloud request: nothing on the server is new for it', () => {
    const server = read('functions/src/index.js');
    expect(server).not.toMatch(/sessionWording|generateSessionWording/);
  });
});

describe('the Today\'s Session screen', () => {
  it('shows the engine\'s session first and asks for the words once the session has settled, after the delay', () => {
    expect(screen).toMatch(/const known = peekWording\(session, \{ unit: weightUnit, equipment \}\);/);
    expect(screen).toMatch(/const found = await wordSession\(session, \{ unit: weightUnit, equipment \}\);/);
    expect(screen).toMatch(/\}, WORDING_RULES\.delayMs\);/);
    expect(screen).toMatch(/return \(\) => \{ cancelled = true; clearTimeout\(timer\); \};/);
    expect(screen).toMatch(/if \(!cancelled\) setWorded\(\{ session, wording: found \}\);/);
  });

  it('asks only for a session that is on the screen, never while it is loading or when there is nothing to pick', () => {
    expect(screen).toMatch(/const ok = !loading && session && session\.status === 'ok';/);
    // ... and not for one the person has swapped or excluded something in: the words were written for the session as it was picked
    expect(screen).toMatch(/if \(!ok \|\| session\.edited\) return undefined;/);
  });

  it('puts the words only on the session they were made for', () => {
    expect(screen).toMatch(/const wording = ok && worded\.session === session \? worded\.wording : null;/);
    expect(screen).toMatch(/const shown = ok \? applyWording\(session, wording\) : null;/);
  });

  it('shows and saves the worded session, with the caption only when words are on it', () => {
    expect(screen).toMatch(/\{shown\.worded && <Text style=\{styles\.wordedCaption\}>\{WORDING_CAPTION\}<\/Text>\}/);
    expect(screen).toMatch(/\{shown\.exercises\.map\(\(x\) => \{/);
    expect(screen).toMatch(/<Text style=\{styles\.sessionTitle\}>\{shown\.name\}<\/Text>/);
    expect(screen).toMatch(/<Text style=\{styles\.cardReason\}>\{x\.reason\}<\/Text>/);
    expect(screen).toMatch(/\{!!shown\.note && <Text style=\{styles\.note\}>\{shown\.note\}<\/Text>\}/);
    expect(screen).toMatch(/const workout = sessionToWorkout\(shown\);/);
  });

  it('takes the sets, reps, targets and the injury line from the engine\'s exercises, whatever the words are', () => {
    expect(screen).toMatch(/\{repsText\(x\)\}/);
    expect(screen).toMatch(/Start at \{x\.target\}/);
    expect(screen).toMatch(/const leftOut = ok \? session\.leftOutFor\.map/);
    expect(screen).not.toMatch(/wording\.exercises|wording\.sets|wording\.reps|wording\.weight/);
  });

  it('follows the unit in Settings > Weight Units', () => {
    expect(screen).toMatch(/const weightUnit = useSettingsStore\(\(s\) => unitFromSetting\(s\.weightUnits\)\);/);
  });
});

describe('what is left as it was', () => {
  it('the Workouts screen and "Surprise me" know nothing of the wording', () => {
    expect(workouts).not.toMatch(/sessionWording|wordSession|generateSessionWording/);
  });

  it('the picker and the session service do not ask the AI: the engine\'s session is the same with or without it', () => {
    [picker, sessionService].forEach((src) => expect(src).not.toMatch(/sessionWording|aiService|generateSessionWording|postLLM/));
  });
});
