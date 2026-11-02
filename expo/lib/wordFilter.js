// lib/wordFilter.js
//
// The basic word list that a post or a comment is checked against before it is saved (store/communityStore.js: createPost, updatePost
// and addComment). It is a first line, not a moderator: it stops the plainest abuse and slurs, and the Report button (components/
// ModerationSheet.jsx) is for everything it does not catch.
//
// WHERE TO CHANGE IT: BLOCKED_WORDS below. One entry per word or short phrase, lower case, letters only, no punctuation. A phrase is
// matched as whole words in that order. Add a word and it is blocked on the next update; take one out and it is allowed again.
// __tests__/wordFilter.test.js checks that every entry is written that way.
//
// How it matches:
//   - Whole words only, so a word inside another word is fine ("class", "assess", "Scunthorpe"). Capitals do not matter.
//   - Accents, apostrophes and common letter swaps are looked through: "f*ck" is not caught, but "fuuuck", "sh1t", "a$$hole" and
//     "FÜCK" are. Letters repeated three times or more count as one.
//   - It reads the text as words separated by anything that is not a letter or digit, so "kill-yourself" and "kill   yourself" match.
// It cannot read intent, so it will also miss anything spelled in a way nobody thought of. That is what reports are for.

export const BLOCKED_WORDS = [
  // Plain abuse and strong swearing
  'fuck', 'fucker', 'fuckers', 'fucking', 'fuckin', 'fucked', 'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shitty', 'shithead', 'bullshit', 'horseshit',
  'bitch', 'bitches', 'bastard', 'bastards', 'asshole', 'assholes', 'arsehole', 'dumbass', 'jackass',
  'cunt', 'cunts', 'whore', 'whores', 'slut', 'sluts', 'wanker', 'twat',
  // Slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'retard', 'retards', 'retarded', 'tranny', 'trannies',
  'kike', 'kikes', 'spic', 'spics', 'chink', 'chinks', 'gook', 'gooks', 'wetback', 'wetbacks',
  // Threats and telling someone to hurt themselves
  'kill yourself', 'kys', 'go die', 'hope you die', 'i will kill you', 'ill kill you', 'rape you',
];

export const CONTENT_NOT_ALLOWED = 'content/not-allowed';

/** What the person is told when a post, comment or edit is turned away. It does not repeat the word: a person can then fix it. */
export const NOT_ALLOWED_MESSAGE = "That has language that isn't allowed on ZOWN HQ. Please change it and try again.";

// Letter swaps people use to get past a filter: 5h1t, a$$hole, f@g. Only inside a word that also has a letter, so "5k" stays "5k".
const SWAPS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

/** The text as lower case words with single spaces between them, with the letter swaps undone: ' sh1t happens ' -> 'shit happens'. */
export function normalizeWords(text) {
  const plain = String(text == null ? '' : text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '');
  return plain
    .split(/[^a-z0-9@$]+/)
    .filter(Boolean)
    .map((word) => (/[a-z]/.test(word) ? word.replace(/[0-9@$]/g, (c) => SWAPS[c]) : word))
    .join(' ');
}

const squeeze = (words) => words.replace(/([a-z])\1{2,}/g, '$1');

/** The entry of BLOCKED_WORDS that the text contains, or null when it has none. */
export function findBlockedWord(text, list = BLOCKED_WORDS) {
  const words = normalizeWords(text);
  if (!words) return null;
  const padded = ` ${words} `;
  const squeezed = ` ${squeeze(words)} `;
  for (const entry of list) {
    const needle = ` ${entry} `;
    if (padded.includes(needle) || squeezed.includes(needle)) return entry;
  }
  return null;
}

/** True when the text has nothing from the list in it (and when there is no text at all). */
export function isTextAllowed(text, list = BLOCKED_WORDS) {
  return findBlockedWord(text, list) === null;
}

/** The error the stores throw for text that is turned away. Checked by its code, not by what kind of error it is. */
export function contentNotAllowedError() {
  const error = new Error('That text is not allowed.');
  error.code = CONTENT_NOT_ALLOWED;
  return error;
}

export const isContentNotAllowed = (e) => !!e && e.code === CONTENT_NOT_ALLOWED;
