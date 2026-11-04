// The Spotify screen (app/spotify-integration.jsx) shows "Loading…" while the playlists come in. The ellipsis had been saved as junk
// characters (a run of accented letters and symbols after the word). This reads every piece of text the screen can show, the JSX text and the quoted strings, and fails on
// the telltale characters of that kind of damage. (Comments are not shown to anyone, so they are not looked at.)
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

// A capital A with a tilde or a circumflex, or an a with a circumflex followed by a euro or quote sign: what a saved "…" turns into.
const DAMAGE = /[\u00c3\u00c2]|\u00e2\u20ac|\u00e2\u201a\u00ac/;
const JUNK = '\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a6';

/** Every string a screen can show: JSX text, string literals and the text parts of template strings, with where each is. */
function shownText(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const found = [];
  const visit = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'JSXText' || n.type === 'StringLiteral') found.push({ text: n.value, line: n.loc.start.line });
    if (n.type === 'TemplateElement') found.push({ text: n.value.cooked ?? n.value.raw, line: n.loc.start.line });
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast.program);
  return found;
}

describe('the damage finder', () => {
  it('finds damaged text in JSX, in a string and in a template, and ignores comments', () => {
    const source = [
      `// Loading${JUNK} in a comment is not shown`,
      `const a = "Loading${JUNK}";`,
      'const b = `Loading ${x}' + JUNK + '`;',
      `const c = <Text>Loading${JUNK}</Text>;`,
      'const d = <Text>Loading…</Text>;',
    ].join('\n');
    const bad = shownText(source).filter((s) => DAMAGE.test(s.text)).map((s) => s.line);
    expect(bad).toEqual([2, 3, 4]);
  });
});

describe('app/spotify-integration.jsx', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'spotify-integration.jsx'), 'utf8');

  it('says "Loading…" with a real ellipsis while the playlists load', () => {
    expect(source).toContain('<Text style={styles.muted}>Loading…</Text>');
  });

  it('shows no damaged text anywhere', () => {
    expect(shownText(source).filter((s) => DAMAGE.test(s.text)).map((s) => `line ${s.line}: ${s.text.trim()}`)).toEqual([]);
  });
});
