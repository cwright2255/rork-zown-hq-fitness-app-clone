// Free / Pro / Legend is held together by pieces in different places: the root layout follows the person's plan from sign-in to sign-out,
// the locked screens are wrapped in the gate, the AI helpers say which allowance they use, and the rules keep the plan out of the phone's
// reach. Each reads a source file, because the layout and the rules need more around them than a test can give. (The rules themselves
// are tried against the Firestore emulator by rules-tests/plans.test.js, which runs in CI.)
const fs = require('fs');
const path = require('path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const layout = read('app', '_layout.jsx');
const authBlock = layout.slice(layout.indexOf('onAuthStateChanged(auth'));
const rules = read('firestore.rules');

// The text of one `match` block in the rules, from its opening brace to the matching closing one.
function ruleBlock(matchPath) {
  const start = rules.indexOf(`match ${matchPath} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start + `match ${matchPath} `.length; i < rules.length; i += 1) {
    if (rules[i] === '{') depth += 1;
    if (rules[i] === '}') depth -= 1;
    if (depth === 0) return rules.slice(start, i + 1);
  }
  return '';
}
const allows = (block) => (block.replace(/\/\/.*$/gm, '').match(/allow [^;]+;/g) || []).map((s) => s.replace(/\s+/g, ' '));

describe('root layout and the plan', () => {
  it('gets the plan store', () => {
    expect(layout).toMatch(/import \{ useEntitlementStore \} from '@\/store\/entitlementStore';/);
  });

  it('starts following the signed-in person\'s plan first, before the stores load, so it does not wait for them', () => {
    expect(authBlock).toMatch(/const uid = firebaseUser\.uid;\s*(?:\/\/[^\n]*\n\s*)*useEntitlementStore\.getState\(\)\.startListening\(uid\);\s*try \{\s*await Promise\.all\(/);
  });

  it('stops following, and forgets the plan, when nobody is signed in', () => {
    expect(authBlock).toMatch(/\} else \{\s*stopXpSync\(\);\s*useEntitlementStore\.getState\(\)\.stopListening\(\);/);
  });

  it('knows the plans screen, and keeps the bottom bar off it', () => {
    expect(layout).toMatch(/<Stack\.Screen name="paywall" \/>/);
    expect(layout).toMatch(/!pathname\.startsWith\('\/paywall'\) && <BottomNavigation \/>/);
  });
});

describe('the locked screens', () => {
  it('puts Analytics behind Pro', () => {
    const src = read('app', 'analytics.jsx');
    expect(src).toMatch(/export default function AnalyticsScreen\(\) \{\s*return \(\s*<PaywallGate feature="analytics">\s*<AnalysisScreen \/>\s*<\/PaywallGate>/);
    expect(src).toMatch(/import PaywallGate from '@\/components\/PaywallGate';/);
    expect(src.match(/export default/g)).toHaveLength(1);
  });

  it('puts scanning a body behind Legend', () => {
    const src = read('app', 'body-scan', 'capture.jsx');
    expect(src).toMatch(/export default function BodyScanCaptureGate\(\) \{\s*return \(\s*<PaywallGate feature="bodyScan">\s*<BodyScanCaptureScreen \/>\s*<\/PaywallGate>/);
    expect(src).toMatch(/import PaywallGate from '@\/components\/PaywallGate';/);
    expect(src.match(/export default/g)).toHaveLength(1);
  });

  it('puts comparing scans behind Legend', () => {
    const src = read('app', 'body-scan', 'compare.jsx');
    expect(src).toMatch(/export default function CompareScansGate\(\) \{\s*return \(\s*<PaywallGate feature="bodyScan">\s*<CompareScansScreen \/>\s*<\/PaywallGate>/);
    expect(src).toMatch(/import PaywallGate from '@\/components\/PaywallGate';/);
    expect(src.match(/export default/g)).toHaveLength(1);
  });

  it('leaves a scan that is already saved open to its owner: the scan\'s own screen is not behind a plan', () => {
    expect(read('app', 'body-scan', '[id].jsx')).not.toMatch(/PaywallGate/);
  });

  it('only gates features that lib/entitlements.js lists', () => {
    const { FEATURES } = require('../lib/entitlements');
    const used = new Set();
    for (const file of [['app', 'analytics.jsx'], ['app', 'body-scan', 'capture.jsx'], ['app', 'body-scan', 'compare.jsx']]) {
      for (const m of read(...file).matchAll(/<PaywallGate feature="(\w+)"/g)) used.add(m[1]);
    }
    for (const feature of used) expect(Object.keys(FEATURES)).toContain(feature);
    expect([...used].sort()).toEqual(['analytics', 'bodyScan']);
  });
});

describe('which allowance each AI helper uses', () => {
  it('has the Help chat count against the helpers, not the Coach', () => {
    expect(read('app', 'profile', 'help.jsx')).toMatch(/chatAI\(messagesPayload, undefined, 'assist'\)/);
  });

  it('has the Coach chat use chatAI\'s default, which is the Coach\'s allowance', () => {
    expect(read('app', 'coach.jsx')).toMatch(/chatAI\(messagesPayload, 45000\)/);
    expect(read('services', 'aiService.js')).toMatch(/export const chatAI = async \(messages, timeoutMs = 30000, kind = 'coach'\)/);
  });

  it('has the meal photo scanner and recipe import count against the helpers by default', () => {
    expect(read('services', 'llmClient.js')).toMatch(/\{ timeoutMs = 60000, kind = 'assist' \} = \{\}/);
  });

  it('keeps the Health screen\'s own comment out of the messages a person sends', () => {
    expect(read('services', 'aiService.js')).toMatch(/postLLM\(\[sys, usr\], 15000, 1, 'insight'\)/);
  });

  it('shows the limit, and the plans, in the Coach and in the meal photo scanner', () => {
    expect(read('app', 'coach.jsx')).toMatch(/upgradeFromError\(e\)/);
    expect(read('app', 'nutrition', 'scan.jsx')).toMatch(/upgradeFromError\(error\)/);
    expect(read('app', 'nutrition', 'scan.jsx')).toMatch(/router\.push\('\/paywall'\)/);
  });
});

describe('AI workout plans, which are part of Pro', () => {
  it('send a Free person from the Workouts screen to the plans', () => {
    const src = read('app', 'workouts.jsx');
    const handler = src.slice(src.indexOf('const handleGetRecommendation'), src.indexOf('const streak = getWorkoutStreak()'));
    expect(handler).toMatch(/const toPlans = planRedirect\(e\);\s*if \(toPlans\) router\.push\(toPlans\);/);
    expect(src).toMatch(/import \{ planRedirect \} from '@\/lib\/upgradePrompt';/);
  });

  it('send a Free person from Quick Workout to the plans (QuickWorkoutPlan.test.jsx runs it)', () => {
    const src = read('app', 'workout', 'quick.jsx');
    expect(src).toMatch(/const toPlans = planRedirect\(e\);\s*if \(toPlans\) router\.push\(toPlans\);/);
  });
});

describe('the rules for the plan', () => {
  it('let a person read their own plan and nobody write it, an admin included', () => {
    expect(allows(ruleBlock('/entitlements/{uid}'))).toEqual([
      'allow read: if request.auth != null && request.auth.uid == uid;',
      'allow write: if false;',
    ]);
  });

  it('keep the AI message counts for the functions alone', () => {
    expect(allows(ruleBlock('/aiUsage/{usageId}'))).toEqual(['allow read, write: if false;']);
  });
});

describe('the functions that enforce the plan', () => {
  const index = read('functions', 'src', 'index.js');

  it('count a postLLM request after checking it is valid, and give the message back if the AI fails', () => {
    const post = index.slice(index.indexOf('export const postLLM'), index.indexOf('export const generateBodyCompositionInsight'));
    expect(post.indexOf("'messages must be a non-empty array'")).toBeLessThan(post.indexOf('takeAiQuota('));
    expect(post.indexOf('takeAiQuota(')).toBeLessThan(post.indexOf('askWithinScope('));
    expect(post).toMatch(/giveBackAiQuota\(\{ db, uid, bucket: quota\.bucket, day: quota\.day \}\)/);
    expect(post).toMatch(/if \(!quota\.ok\) throw aiLimitReached\(quota\);/);
  });

  it('check the plan before doing any work in the workout-plan and body-scan functions', () => {
    const plan = index.slice(index.indexOf('export const generateWorkoutPlan'), index.indexOf('export const getProgressSummary'));
    expect(plan).toMatch(/requireAuth\(req\.auth\);\s*await requireFeature\(uid, 'aiWorkoutPlan'\);/);
    const scan = index.slice(index.indexOf('export const generateBodyCompositionInsight'), index.indexOf('export const getNutritionRecommendations'));
    expect(scan).toMatch(/requireAuth\(req\.auth\);\s*await requireFeature\(uid, 'bodyScan'\);/);
  });

  it('use the same plans file as the app', () => {
    expect(index).toMatch(/from '\.\/entitlements\.js'/);
    expect(index).toMatch(/from '\.\/aiQuota\.js'/);
  });
});
