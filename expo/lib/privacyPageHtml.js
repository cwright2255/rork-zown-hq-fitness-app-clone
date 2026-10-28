// Turns the in-app Privacy Policy screen (app/profile/privacy-policy.jsx) into the public web page (site/privacy.html), so
// the words people read on the web are the words in the app and there is one place to edit them.
//
// It reads the screen's rendered tree (react-test-renderer's toJSON), not its source. The screen keeps a few conventions this
// relies on, and __tests__/privacyPage.test.js fails if one of them changes:
//   the header title is the Text "Privacy Policy"        -> the page title
//   "Last updated: ..."                                   -> the date line
//   a Text that starts "1. ", "2. " ... with no Text in it -> a section heading
//   a Text that starts "• "                               -> a bullet (a nested Text inside it is bold)
//   any other Text                                        -> a paragraph
//
// To rebuild the page after the policy changes:  cd expo && WRITE_PRIVACY_PAGE=1 npx jest __tests__/privacyPage.test.js
// then deploy it (docs/PRIVACY_PAGE.md).

export const PAGE_TITLE = 'Privacy Policy';
export const SITE_NAME = 'ZOWN HQ';
const DESCRIPTION = 'What ZOWN HQ collects, why, who it is shared with, and the choices you have.';

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// An email address in the text becomes a mailto link. The text itself does not change.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const withLinks = (escaped) => escaped.replace(EMAIL, (email) => `<a href="mailto:${email}">${email}</a>`);

const isElement = (node) => node && typeof node === 'object' && !Array.isArray(node);
const childrenOf = (node) => (isElement(node) && Array.isArray(node.children) ? node.children : []);
const hasNestedText = (node) => childrenOf(node).some((c) => isElement(c));

/** All the words of a Text node, with nested Text (bold) kept as <strong>. */
function inline(node, { stripBullet = false } = {}) {
  let first = true;
  return childrenOf(node).map((child) => {
    if (typeof child === 'string') {
      let text = child;
      if (stripBullet && first) text = text.replace(/^•\s*/, '');
      first = false;
      return withLinks(escapeHtml(text));
    }
    first = false;
    return `<strong>${inline(child)}</strong>`;
  }).join('');
}

const plainText = (node) => childrenOf(node).map((c) => (typeof c === 'string' ? c : plainText(c))).join('');

// Every top-level Text on the screen, in reading order. A Text is not entered: its nested Text is part of it.
function collectTexts(node, out = []) {
  if (Array.isArray(node)) { node.forEach((n) => collectTexts(n, out)); return out; }
  if (!isElement(node)) return out;
  if (node.type === 'Text') { out.push(node); return out; }
  childrenOf(node).forEach((c) => collectTexts(c, out));
  return out;
}

/** The blocks of the page: [{ kind: 'title' | 'updated' | 'heading' | 'bullet' | 'paragraph', html }] */
export function policyBlocks(tree) {
  const blocks = [];
  let titled = false;
  for (const text of collectTexts(tree)) {
    const plain = plainText(text);
    if (!titled && plain === PAGE_TITLE) { titled = true; blocks.push({ kind: 'title', html: escapeHtml(plain) }); continue; }
    if (/^Last updated:/.test(plain)) { blocks.push({ kind: 'updated', html: inline(text) }); continue; }
    if (/^\d{1,2}\. /.test(plain) && !hasNestedText(text)) { blocks.push({ kind: 'heading', html: inline(text) }); continue; }
    if (/^•/.test(plain)) { blocks.push({ kind: 'bullet', html: inline(text, { stripBullet: true }) }); continue; }
    blocks.push({ kind: 'paragraph', html: inline(text) });
  }
  return blocks;
}

const CSS = `
:root { color-scheme: light dark; --ink: #111; --muted: #5c5c5c; --paper: #fff; --rule: #e2e2e2; --link: #0a58ca; }
@media (prefers-color-scheme: dark) { :root { --ink: #f2f2f2; --muted: #a8a8a8; --paper: #0d0d0d; --rule: #2e2e2e; --link: #8ab4ff; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.wrap { max-width: 42rem; margin: 0 auto; padding: 1.25rem 1rem 4rem; }
.brand { margin: 0 0 2.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); font-weight: 800; letter-spacing: .12em; }
h1 { margin: 0 0 .25rem; font-size: 2rem; line-height: 1.2; }
h2 { margin: 2.25rem 0 .75rem; font-size: 1.2rem; line-height: 1.3; }
p { margin: 0 0 1rem; }
.updated { color: var(--muted); font-size: .9rem; margin-bottom: 1.5rem; }
ul { margin: 0 0 1rem; padding-left: 1.25rem; }
li { margin-bottom: .6rem; }
a { color: var(--link); }
`.trim();

/** The whole page, from the screen's rendered tree. */
export function privacyPageHtml(tree) {
  const parts = [];
  let inList = false;
  for (const block of policyBlocks(tree)) {
    if (block.kind !== 'bullet' && inList) { parts.push('</ul>'); inList = false; }
    if (block.kind === 'bullet' && !inList) { parts.push('<ul>'); inList = true; }
    if (block.kind === 'title') parts.push(`<h1>${block.html}</h1>`);
    else if (block.kind === 'updated') parts.push(`<p class="updated">${block.html}</p>`);
    else if (block.kind === 'heading') parts.push(`<h2>${block.html}</h2>`);
    else if (block.kind === 'bullet') parts.push(`<li>${block.html}</li>`);
    else parts.push(`<p>${block.html}</p>`);
  }
  if (inList) parts.push('</ul>');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${PAGE_TITLE} - ${SITE_NAME}</title>
<meta name="description" content="${DESCRIPTION}">
<style>
${CSS}
</style>
</head>
<body>
<div class="wrap">
<p class="brand">${SITE_NAME}</p>
<article>
${parts.join('\n')}
</article>
</div>
</body>
</html>
`;
}
