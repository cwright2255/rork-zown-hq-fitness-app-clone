/**
 * jscodeshift AST codemod: replace legacy hex literals with Fitleus theme tokens.
 *
 * Usage (from repo root):
 *   tools/codemods/run-replace-legacy-colors.sh
 *
 * What it does:
 *   - Loads the JSON map from theme/legacy-color-map.json (a pre-extracted JSON
 *     mirror of theme/legacy-color-map.ts).
 *   - For every StringLiteral whose value matches /^#[0-9a-fA-F]{3,8}$/ in:
 *       * ObjectProperty values where the key name is a known style key
 *         (color, backgroundColor, borderColor, borderTopColor, borderRightColor,
 *          borderBottomColor, borderLeftColor, tintColor, shadowColor, overlayColor,
 *          placeholderTextColor, underlayColor, separatorColor)
 *       * JSXAttribute values where the attribute name is one of the above
 *   - Replaces the literal with a MemberExpression like `tokens.colors.brand.primary`.
 *   - For JSXAttribute replacements, ALWAYS wraps in JSXExpressionContainer so
 *     the JSX is syntactically valid (no `color=tokens.colors.x`).
 *   - When any replacement is made in a file and `tokens` is not already imported,
 *     prepends a top-level ImportDeclaration:
 *       import { tokens } from '<computed relative path>/theme/tokens';
 *   - Skips files where parse fails; never inserts inside an existing import statement.
 */
const path = require('path');
const fs = require('fs');

const STYLE_KEYS = new Set([
  'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'tintColor', 'shadowColor', 'overlayColor',
  'placeholderTextColor', 'underlayColor', 'separatorColor',
]);

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function loadMap() {
  // Prefer JSON sibling; fall back to parsing the .ts file with a regex.
  const repoRoot = path.resolve(__dirname, '..', '..');
  const jsonPath = path.join(repoRoot, 'theme', 'legacy-color-map.json');
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
  const tsPath = path.join(repoRoot, 'theme', 'legacy-color-map.ts');
  const ts = fs.readFileSync(tsPath, 'utf8');
  const map = {};
  const re = /"(#[A-Fa-f0-9]{3,8})"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    if (m[2] !== 'TODO_REVIEW') map[m[1].toUpperCase()] = m[2];
  }
  return map;
}

function buildTokenMember(j, tokenPath) {
  // tokens.colors.brand.primary  -> nested MemberExpression
  // For digit-prefixed segments, fall back to bracket access.
  const parts = tokenPath.split('.');
  let node = j.identifier('tokens');
  for (const part of parts) {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)) {
      node = j.memberExpression(node, j.identifier(part), false);
    } else {
      node = j.memberExpression(node, j.literal(part), true);
    }
  }
  return node;
}

function relImportFrom(filePath) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const dir = path.dirname(path.relative(repoRoot, filePath));
  const fromDirToTheme = path.relative(dir, 'theme');
  // Always use forward slashes for module specifiers.
  return fromDirToTheme.replace(/\\/g, '/').replace(/\\.\\.\\.\\.\\.$/g, '../') + '/tokens';
}

function ensureTokensImport(j, root, importPath) {
  const existing = root
    .find(j.ImportDeclaration, { source: { value: importPath } })
    .filter(p => p.value.specifiers.some(s => s.imported && s.imported.name === 'tokens'));
  if (existing.size() > 0) return false;
  const importDecl = j.importDeclaration(
    [j.importSpecifier(j.identifier('tokens'), j.identifier('tokens'))],
    j.literal(importPath)
  );
  // Prepend after any existing imports
  const allImports = root.find(j.ImportDeclaration);
  if (allImports.size() > 0) {
    allImports.at(-1).insertAfter(importDecl);
  } else {
    root.get().node.program.body.unshift(importDecl);
  }
  return true;
}

module.exports = function transform(file, api) {
  const j = api.jscodeshift;
  let root;
  try {
    root = j(file.source);
  } catch (e) {
    console.error('Parse error:', file.path, e.message);
    return file.source;
  }

  const map = loadMap();
  let replacements = 0;
  let skipped = 0;

  // 1. ObjectProperty: { color: '#FFFFFF' }
  root.find(j.ObjectProperty).forEach(p => {
    const key = p.value.key;
    const val = p.value.value;
    const keyName = key.name || key.value;
    if (!STYLE_KEYS.has(keyName)) return;
    if (val.type !== 'Literal' && val.type !== 'StringLiteral') return;
    const hex = val.value;
    if (typeof hex !== 'string' || !HEX_RE.test(hex)) return;
    const tokenPath = map[hex.toUpperCase()];
    if (!tokenPath) { skipped++; return; }
    p.value.value = buildTokenMember(j, tokenPath);
    replacements++;
  });

  // 2. JSXAttribute: <View color="#FFFFFF" />
  root.find(j.JSXAttribute).forEach(p => {
    const attrName = p.value.name && p.value.name.name;
    if (!STYLE_KEYS.has(attrName)) return;
    const val = p.value.value;
    if (!val) return;
    if (val.type !== 'Literal' && val.type !== 'StringLiteral') return;
    const hex = val.value;
    if (typeof hex !== 'string' || !HEX_RE.test(hex)) return;
    const tokenPath = map[hex.toUpperCase()];
    if (!tokenPath) { skipped++; return; }
    p.value.value = j.jsxExpressionContainer(buildTokenMember(j, tokenPath));
    replacements++;
  });

  if (replacements > 0) {
    const importPath = relImportFrom(file.path);
    ensureTokensImport(j, root, importPath);
    console.error(`[${file.path}] +${replacements} replacements, ?${skipped} skipped`);
  }

  return root.toSource({ quote: 'single' });
};

module.exports.parser = 'tsx';
