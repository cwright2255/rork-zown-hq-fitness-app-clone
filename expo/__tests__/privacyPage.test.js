// The public Privacy Policy page (site/privacy.html) must say exactly what the in-app screen says. The page is built from the
// screen (lib/privacyPageHtml.js), and this test fails if the file in the repo is not what the screen would build now.
//
// After changing app/profile/privacy-policy.jsx:   WRITE_PRIVACY_PAGE=1 npx jest __tests__/privacyPage.test.js
// then deploy the page (docs/PRIVACY_PAGE.md).
const fs = require('fs');
const path = require('path');
const React = require('react');
const { render } = require('@testing-library/react-native');

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

const PrivacyPolicy = require('../app/profile/privacy-policy').default;
const { privacyPageHtml, policyBlocks, PAGE_TITLE } = require('../lib/privacyPageHtml');

const SITE_DIR = path.join(__dirname, '..', 'site');
const PAGE_FILE = path.join(SITE_DIR, 'privacy.html');

const screenTree = () => render(React.createElement(PrivacyPolicy)).toJSON();
const textOf = (node) => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.children);
};

// Hand-made trees, in the shape react-test-renderer gives.
const text = (...children) => ({ type: 'Text', props: {}, children });
const view = (...children) => ({ type: 'View', props: {}, children });

describe('building the page from a screen', () => {
  it('makes the header title the page title, then the date, headings, bullets and paragraphs, in order', () => {
    const tree = view(
      view(text('Privacy Policy')),
      view(
        text('Last updated: October 2026'),
        text('An introduction.'),
        text('1. Information We Collect'),
        text('• ', text('Account'), ': your name.'),
        text('• Location: GPS.'),
        text('Closing words.'),
      ),
    );
    expect(policyBlocks(tree)).toEqual([
      { kind: 'title', html: 'Privacy Policy' },
      { kind: 'updated', html: 'Last updated: October 2026' },
      { kind: 'paragraph', html: 'An introduction.' },
      { kind: 'heading', html: '1. Information We Collect' },
      { kind: 'bullet', html: '<strong>Account</strong>: your name.' },
      { kind: 'bullet', html: 'Location: GPS.' },
      { kind: 'paragraph', html: 'Closing words.' },
    ]);
  });

  it('puts neighbouring bullets in one list and closes the list before the next heading or paragraph', () => {
    const tree = view(text('Privacy Policy'), text('• one'), text('• two'), text('2. Next'), text('• three'));
    const html = privacyPageHtml(tree);
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<h2>2. Next</h2>\n<ul>\n<li>three</li>\n</ul>');
  });

  it('closes a list that runs to the end of the page', () => {
    expect(privacyPageHtml(view(text('Privacy Policy'), text('• last')))).toContain('<li>last</li>\n</ul>\n</article>');
  });

  it('does not treat a numbered line that contains bold text as a heading', () => {
    const blocks = policyBlocks(view(text('Privacy Policy'), text('3. A ', text('bold'), ' step.')));
    expect(blocks[1].kind).toBe('paragraph');
  });

  it('uses only the first "Privacy Policy" as the title', () => {
    const blocks = policyBlocks(view(text('Privacy Policy'), text('Privacy Policy')));
    expect(blocks.map((b) => b.kind)).toEqual(['title', 'paragraph']);
  });

  it('escapes what would otherwise be read as markup', () => {
    const html = privacyPageHtml(view(text('Privacy Policy'), text('Tom & Jerry <b>2 > 1</b>')));
    expect(html).toContain('<p>Tom &amp; Jerry &lt;b&gt;2 &gt; 1&lt;/b&gt;</p>');
    expect(html).not.toContain('<b>');
  });

  it('links an email address without changing its words, and leaves the full stop after it out of the link', () => {
    const html = privacyPageHtml(view(text('Privacy Policy'), text('Email privacy@zownhq.com. Or support@zownhq.com')));
    expect(html).toContain('<p>Email <a href="mailto:privacy@zownhq.com">privacy@zownhq.com</a>. Or <a href="mailto:support@zownhq.com">support@zownhq.com</a></p>');
  });

  it('is a complete page that works on a phone and in dark mode, with no scripts and nothing loaded from elsewhere', () => {
    const html = privacyPageHtml(view(text('Privacy Policy')));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<title>Privacy Policy - ZOWN HQ</title>');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).not.toMatch(/<script|<link|<img|src=|@import|url\(/i);
  });

  it('gives the same page every time', () => {
    const tree = view(text('Privacy Policy'), text('1. A'), text('• b'));
    expect(privacyPageHtml(tree)).toBe(privacyPageHtml(tree));
  });
});

describe('the Privacy Policy screen still follows the conventions the page is built from', () => {
  const blocks = () => policyBlocks(screenTree());

  it('has one title and one date, the date right after the title', () => {
    const kinds = blocks().map((b) => b.kind);
    expect(kinds.filter((k) => k === 'title')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'updated')).toHaveLength(1);
    expect(kinds.slice(0, 2)).toEqual(['title', 'updated']);
    expect(blocks()[0].html).toBe(PAGE_TITLE);
  });

  it('has its sections numbered 1, 2, 3 ... as headings, none missing', () => {
    const headings = blocks().filter((b) => b.kind === 'heading').map((b) => Number(b.html.match(/^(\d{1,2})\. /)[1]));
    expect(headings.length).toBeGreaterThanOrEqual(12);
    expect(headings).toEqual(headings.map((_, i) => i + 1));
  });

  it('has no numbered heading that came out as a paragraph, and no bullet mark left in the words', () => {
    for (const b of blocks()) {
      if (b.kind === 'paragraph') expect(b.html).not.toMatch(/^\d{1,2}\. [A-Z]/);
      expect(b.html).not.toContain('•');
    }
  });

  it('has bullets, with their lead-in words in bold', () => {
    const bullets = blocks().filter((b) => b.kind === 'bullet');
    expect(bullets.length).toBeGreaterThan(10);
    expect(bullets.some((b) => b.html.startsWith('<strong>Account</strong>'))).toBe(true);
  });
});

describe('site/privacy.html', () => {
  const built = () => privacyPageHtml(screenTree());

  it('is exactly what the in-app screen builds now (rebuild with WRITE_PRIVACY_PAGE=1 npx jest __tests__/privacyPage.test.js)', () => {
    if (process.env.WRITE_PRIVACY_PAGE === '1') {
      fs.mkdirSync(SITE_DIR, { recursive: true });
      fs.writeFileSync(PAGE_FILE, built());
    }
    expect(fs.existsSync(PAGE_FILE)).toBe(true);
    expect(fs.readFileSync(PAGE_FILE, 'utf8')).toBe(built());
  });

  it('says every word the screen says, in the same order (checked without trusting the builder)', () => {
    const file = fs.readFileSync(PAGE_FILE, 'utf8');
    const article = file.match(/<article>([\s\S]*)<\/article>/)[1];
    const pageWords = article.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, '');
    const screenWords = textOf(screenTree()).replace(/•/g, '').replace(/\s+/g, '');
    expect(pageWords).toBe(screenWords);
  });

  it('names the three sign-ins, the contact address and the Apple disconnect, like the screen', () => {
    const file = fs.readFileSync(PAGE_FILE, 'utf8');
    expect(file).toContain('Last updated: October 2026');
    expect(file).toContain('If you sign in with Apple, Google or Meta instead');
    expect(file).toContain('privacy@zownhq.com');
    expect(file).toContain('deleting your account also disconnects ZOWN HQ from your Apple ID');
  });
});

describe('site/firebase.json (the page is hosted on its own Firebase Hosting site)', () => {
  const config = () => JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'firebase.json'), 'utf8'));

  it('serves this folder on a site of its own, so the project\'s main site is left alone', () => {
    const { hosting } = config();
    expect(Array.isArray(hosting)).toBe(false);
    expect(hosting.site).toBe('zown-3c512-legal');
    expect(hosting.site).not.toBe('zown-3c512');
    expect(hosting.public).toBe('.');
  });

  it('serves /privacy (no .html) and does not publish its own config or hidden files', () => {
    const { hosting } = config();
    expect(hosting.cleanUrls).toBe(true);
    expect(hosting.trailingSlash).toBe(false);
    expect(hosting.ignore).toEqual(expect.arrayContaining(['firebase.json', '**/.*']));
    expect(fs.existsSync(path.join(SITE_DIR, 'privacy.html'))).toBe(true);
  });

  it('is not the main firebase.json, which still has the project\'s own hosting entry', () => {
    const main = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
    expect(main.hosting.public).toBe('../admin');
    expect(main.hosting.site).toBeUndefined();
  });
});
