// Spoken labels on the buttons that are only a picture (Build 12, finding #21).
//
// VoiceOver reads a button out by its words. A button that is only an icon has none, so it is read as just "button", and a person using
// VoiceOver cannot tell the back arrow from the three dots. Every icon-only button on the four screens the finding names has to carry
// a role and a spoken label that says what it does:
//   - the active workout (app/workout/active.jsx)
//   - Social (app/social.jsx)
//   - onboarding (app/onboarding.jsx)
//   - register (app/auth/register.jsx)
//
// The screens are not rendered here (the workout screen needs most of the app behind it), so, like screenHeaderSafeArea.test.js, this
// reads each screen's source and finds the buttons. A button counts as icon-only when it has an onPress, has an icon inside it, and has
// no <Text> inside it that is always shown (a number that appears only when a setting allows it does not name the button). The labels
// that change with the screen's state (like / unlike, show / hide password) are checked on rendered screens in SocialButtonLabels.test.jsx and
// RegisterButtonLabels.test.jsx; what VoiceOver actually says is checked on the phone (docs/DEVICE_CHECKS.md, Build 12).
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const TOUCHABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback']);

const nameOf = (el) => {
  const n = el.openingElement.name;
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression') return n.property.name;
  return '';
};
const attrOf = (el, name) => el.openingElement.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === name);

// A picture: an Ionicons / lucide icon (they all take a `size`) or an Image. A spinner takes a size too, and is not one.
const isPicture = (el) => {
  const name = nameOf(el);
  if (name === 'ActivityIndicator') return false;
  return name === 'Ionicons' || name === 'Image' || !!attrOf(el, 'size');
};

// A label counts when it is words, or when it is worked out on the screen (a variable, a template, a choice between two).
// An empty string does not count, and neither does `undefined` or `null`, or a choice with one of those on either side.
const says = (e) => {
  if (!e) return false;
  if (e.type === 'StringLiteral') return e.value.trim().length > 0;
  if (e.type === 'TemplateLiteral') return e.quasis.some((q) => q.value.raw.trim().length > 0) || e.expressions.length > 0;
  if (e.type === 'ConditionalExpression') return says(e.consequent) && says(e.alternate);
  if (e.type === 'NullLiteral' || e.type === 'JSXEmptyExpression') return false;
  if (e.type === 'Identifier') return e.name !== 'undefined';
  return true;
};
const isSpoken = (attr) => {
  if (!attr || !attr.value) return false;
  if (attr.value.type === 'StringLiteral') return says(attr.value);
  return attr.value.type === 'JSXExpressionContainer' && says(attr.value.expression);
};

/**
 * What is inside a button: whether there is a picture, and whether there is a <Text> that is always shown.
 * A button inside the button (a sheet's backdrop holds the sheet, a row holds a small follow button) is judged on its own, so what is
 * inside it is not counted here. A `? :` shows a <Text> only when both of its branches do, and a `&&` never does: the <Text> after it
 * is there only some of the time.
 */
function contentsOf(button) {
  let picture = false;
  const showsText = (node) => {
    if (!node || typeof node.type !== 'string') return false;
    if (node.type === 'JSXElement') {
      if (TOUCHABLES.has(nameOf(node))) return false;
      if (isPicture(node)) picture = true;
      if (nameOf(node) === 'Text') return true;
    }
    if (node.type === 'ConditionalExpression') {
      const whenTrue = showsText(node.consequent);
      const whenFalse = showsText(node.alternate);
      return whenTrue && whenFalse;
    }
    if (node.type === 'LogicalExpression') {
      showsText(node.left);
      showsText(node.right);
      return false;
    }
    let shown = false;
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach((c) => { if (showsText(c)) shown = true; });
      else if (child && typeof child === 'object' && showsText(child)) shown = true;
    }
    return shown;
  };
  let text = false;
  (button.children || []).forEach((c) => { if (showsText(c)) text = true; });
  return { picture, text };
}

/** Every icon-only button in the source: its line, and whether it has a spoken label and a role. */
function iconOnlyButtons(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const buttons = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXElement' && TOUCHABLES.has(nameOf(node)) && attrOf(node, 'onPress')) {
      const inside = contentsOf(node);
      if (inside.picture && !inside.text) {
        buttons.push({
          line: node.loc.start.line,
          named: isSpoken(attrOf(node, 'accessibilityLabel')),
          role: !!attrOf(node, 'accessibilityRole'),
        });
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast.program);
  return buttons;
}

const wrap = (jsx) => `export default function S() { return (${jsx}); }`;

describe('how an icon-only button is told from the rest', () => {
  it('finds a button that is only an icon, and sees it has no label and no role', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={go}><Ionicons name="close" size={22} /></Pressable>'));
    expect(found).toEqual([{ line: 1, named: false, role: false }]);
  });

  it('is satisfied by a role and a label together', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={22} /></Pressable>'));
    expect(found).toEqual([{ line: 1, named: true, role: true }]);
  });

  it('wants the role as well as the label', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityLabel="Close"><Ionicons name="close" size={22} /></Pressable>'));
    expect(found[0]).toMatchObject({ named: true, role: false });
  });

  it('does not take an empty label as a label', () => {
    expect(iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityRole="button" accessibilityLabel=""><Ionicons name="x" size={1} /></Pressable>'))[0].named).toBe(false);
    expect(iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityRole="button" accessibilityLabel={"  "}><Ionicons name="x" size={1} /></Pressable>'))[0].named).toBe(false);
    expect(iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityRole="button" accessibilityLabel><Ionicons name="x" size={1} /></Pressable>'))[0].named).toBe(false);
  });

  it('does not take a label that works out to nothing: undefined, null, or a choice with nothing on one side', () => {
    const labelled = (value) => iconOnlyButtons(wrap(`<Pressable onPress={go} accessibilityRole="button" accessibilityLabel={${value}}><Ionicons name="x" size={1} /></Pressable>`))[0].named;
    expect(labelled('undefined')).toBe(false);
    expect(labelled('null')).toBe(false);
    expect(labelled("on ? 'Pause' : undefined")).toBe(false);
    expect(labelled("on ? null : 'Play'")).toBe(false);
    expect(labelled("on ? 'Pause' : ''")).toBe(false);
    expect(labelled('`   `')).toBe(false);
    expect(labelled("on ? 'Pause' : 'Play'")).toBe(true);
    expect(labelled('title')).toBe(true);
    expect(labelled('`Challenge ${name}`')).toBe(true);
    expect(labelled('`${name}`')).toBe(true);
  });

  it('takes a label that the screen works out as it goes', () => {
    const choice = iconOnlyButtons(wrap('<TouchableOpacity onPress={go} accessibilityRole="button" accessibilityLabel={on ? "Hide" : "Show"}><Eye size={18} /></TouchableOpacity>'));
    const template = iconOnlyButtons(wrap('<Pressable onPress={go} accessibilityRole="button" accessibilityLabel={`Challenge ${name}`}><Ionicons name="flash" size={16} /></Pressable>'));
    expect(choice[0].named).toBe(true);
    expect(template[0].named).toBe(true);
  });

  it('finds the icon from lucide (it has a size and no name of its own) as well as from Ionicons', () => {
    expect(iconOnlyButtons(wrap('<TouchableOpacity onPress={go}><ChevronLeft size={24} color="#000" /></TouchableOpacity>'))).toHaveLength(1);
  });

  it('leaves out a button that has words of its own', () => {
    expect(iconOnlyButtons(wrap('<Pressable onPress={go}><Ionicons name="trash" size={18} /><Text>Delete</Text></Pressable>'))).toEqual([]);
  });

  it('does not count a number that shows only some of the time as the words of the button', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={go}><Ionicons name="heart" size={18} />{show && <Text>{count}</Text>}</Pressable>'));
    expect(found).toHaveLength(1);
    const either = iconOnlyButtons(wrap('<Pressable onPress={go}><Ionicons name="heart" size={18} />{show ? <Text>{count}</Text> : null}</Pressable>'));
    expect(either).toHaveLength(1);
  });

  it('leaves out a backdrop that holds other things, a button with no picture, and a spinner', () => {
    expect(iconOnlyButtons(wrap('<Pressable onPress={close}><MenuOption icon="a" label="b" /></Pressable>'))).toEqual([]);
    expect(iconOnlyButtons(wrap('<Pressable onPress={go}><View /></Pressable>'))).toEqual([]);
    expect(iconOnlyButtons(wrap('<Pressable onPress={go}><ActivityIndicator size="small" /></Pressable>'))).toEqual([]);
  });

  it('leaves out something that is pressable in name only (no onPress)', () => {
    expect(iconOnlyButtons(wrap('<Pressable><Ionicons name="x" size={1} /></Pressable>'))).toEqual([]);
  });

  it('judges the button inside a button on its own', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={a}><Text>Ana</Text><Pressable onPress={b}><Ionicons name="person-add" size={17} /></Pressable></Pressable>'));
    expect(found).toHaveLength(1);
    expect(found[0].named).toBe(false);
  });

  it('does not take the icons of a button inside a button for the outer one\'s own', () => {
    const found = iconOnlyButtons(wrap('<Pressable onPress={close}><Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Play"><Ionicons name="play" size={28} /></Pressable></Pressable>'));
    expect(found).toEqual([{ line: 1, named: true, role: true }]);
  });

  it('counts a <Text> in both branches of a choice as always shown, and one in a single branch as not', () => {
    const both = iconOnlyButtons(wrap('<Pressable onPress={a}>{on ? <Text>Connected</Text> : <View><Ionicons name="musical-notes" size={40} /><Text>Connect</Text></View>}</Pressable>'));
    expect(both).toEqual([]);
    const one = iconOnlyButtons(wrap('<Pressable onPress={a}><Ionicons name="x" size={1} />{on ? <Text>Connected</Text> : null}</Pressable>'));
    expect(one).toHaveLength(1);
  });
});

// How many icon-only buttons each screen has today. The count is a floor, not an exact number: it is there so that this test cannot go quiet
// by finding nothing, and a new icon button without a label still fails the test below.
const SCREENS = [
  { name: 'the active workout', file: 'app/workout/active.jsx', atLeast: 11 },
  { name: 'Social', file: 'app/social.jsx', atLeast: 14 },
  { name: 'onboarding', file: 'app/onboarding.jsx', atLeast: 1 },
  { name: 'register', file: 'app/auth/register.jsx', atLeast: 3 },
];

describe.each(SCREENS)('$name', ({ file, atLeast }) => {
  const buttons = iconOnlyButtons(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const where = (list) => list.map((b) => `${file}:${b.line}`);

  it('has its icon-only buttons found', () => {
    expect(buttons.length).toBeGreaterThanOrEqual(atLeast);
  });

  it('gives every icon-only button a spoken label', () => {
    expect(where(buttons.filter((b) => !b.named))).toEqual([]);
  });

  it('gives every icon-only button the role of a button', () => {
    expect(where(buttons.filter((b) => !b.role))).toEqual([]);
  });
});
