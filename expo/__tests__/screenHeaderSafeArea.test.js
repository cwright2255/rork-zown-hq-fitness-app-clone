// ScreenHeader pads itself for the status bar and notch (components/ScreenHeader.jsx).
// A SafeAreaView that also pads the top, wrapped around it, adds that space a second
// time: a blank band above the title, about 60 points tall on a phone with a notch.
// This reads every screen in app/ and finds that combination.
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const APP_DIR = path.join(__dirname, '..', 'app');

const nameOf = (node) => (node.openingElement.name.type === 'JSXIdentifier' ? node.openingElement.name.name : null);

// Whether a SafeAreaView pads the top: it does unless `edges` is a list that leaves 'top' out.
// An `edges` written any other way (a variable, an object) is not judged.
function padsTop(node) {
  const attr = node.openingElement.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'edges');
  if (!attr) return true;
  const value = attr.value && attr.value.type === 'JSXExpressionContainer' ? attr.value.expression : null;
  if (!value || value.type !== 'ArrayExpression') return false;
  return value.elements.some((e) => e && e.type === 'StringLiteral' && e.value === 'top');
}

function contains(node, wanted) {
  let found = false;
  const visit = (n) => {
    if (found || !n || typeof n.type !== 'string') return;
    if (n.type === 'JSXElement' && nameOf(n) === wanted) { found = true; return; }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  (node.children || []).forEach(visit);
  return found;
}

// The line of every SafeAreaView that pads the top and has a ScreenHeader inside it.
function doubledHeaders(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const lines = [];
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'JSXElement' && nameOf(n) === 'SafeAreaView' && padsTop(n) && contains(n, 'ScreenHeader')) {
      lines.push(n.loc.start.line);
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast.program);
  return lines;
}

function screenFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(full);
    return /\.jsx$/.test(entry.name) ? [full] : [];
  });
}

describe('finding a header inside a second top safe area', () => {
  it('flags a SafeAreaView with no edges, or with top in them, around a ScreenHeader', () => {
    const wrap = (open, close = '</SafeAreaView>') => `export default function S() {\n  return (\n    ${open}\n      <ScreenHeader title="x" />\n    ${close}\n  );\n}\n`;
    expect(doubledHeaders(wrap('<SafeAreaView style={s}>'))).toEqual([3]);
    expect(doubledHeaders(wrap("<SafeAreaView edges={['top']}>"))).toEqual([3]);
    expect(doubledHeaders(wrap("<SafeAreaView edges={['top', 'bottom']}>"))).toEqual([3]);
  });

  it('leaves alone a header in a view that does not pad the top, and a safe area with no header', () => {
    const wrap = (open, close, inner = '<ScreenHeader title="x" />') => `export default function S() {\n  return (\n    ${open}\n      ${inner}\n    ${close}\n  );\n}\n`;
    expect(doubledHeaders(wrap("<SafeAreaView edges={['bottom', 'left', 'right']}>", '</SafeAreaView>'))).toEqual([]);
    expect(doubledHeaders(wrap('<SafeAreaView edges={[]}>', '</SafeAreaView>'))).toEqual([]);
    expect(doubledHeaders(wrap('<View style={s}>', '</View>'))).toEqual([]);
    expect(doubledHeaders(wrap('<SafeAreaView>', '</SafeAreaView>', '<Text>no header here</Text>'))).toEqual([]);
  });

  it('finds the header when it is nested inside other views', () => {
    const src = 'export default function S() {\n  return (\n    <SafeAreaView>\n      <View>\n        {ok ? <ScreenHeader title="x" /> : null}\n      </View>\n    </SafeAreaView>\n  );\n}\n';
    expect(doubledHeaders(src)).toEqual([3]);
  });
});

// Screens this still happens on, by file and how many times. Fixing one means lowering
// its number (or removing the line); a new screen with the problem fails here.
const STILL_DOUBLED = {
  'app/nutrition/barcode-scan.jsx': 3, // the loading, camera-access and Product Found screens
  'app/running/hiking/[id].jsx': 1, // the trail detail with its photo
};

describe('screens in app/', () => {
  const found = {};
  screenFiles(APP_DIR).forEach((file) => {
    const lines = doubledHeaders(fs.readFileSync(file, 'utf8'));
    if (lines.length) found[path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/')] = lines.length;
  });

  it('add no second top safe area around a ScreenHeader, except those still listed', () => {
    expect(found).toEqual(STILL_DOUBLED);
  });
});
