// The basic word list a post or a comment is checked against before it is saved (lib/wordFilter.js).
import {
  BLOCKED_WORDS, NOT_ALLOWED_MESSAGE, CONTENT_NOT_ALLOWED, normalizeWords, findBlockedWord, isTextAllowed,
  contentNotAllowedError, isContentNotAllowed,
} from '../lib/wordFilter';
import { postErrorMessage } from '../lib/postMedia';

describe('the list', () => {
  it('is a real list', () => {
    expect(BLOCKED_WORDS.length).toBeGreaterThan(30);
  });

  it('is written the way the filter reads it: lower case letters, one space between words, nothing else', () => {
    const bad = BLOCKED_WORDS.filter((entry) => !/^[a-z]+( [a-z]+)*$/.test(entry));
    expect(bad).toEqual([]);
  });

  it('has no entry twice', () => {
    expect(new Set(BLOCKED_WORDS).size).toBe(BLOCKED_WORDS.length);
  });

  it('is turned away entry by entry: each one on its own, in a sentence, shouted, and in a different case', () => {
    for (const entry of BLOCKED_WORDS) {
      expect(findBlockedWord(entry)).toBe(entry);
      expect(isTextAllowed(`you are such a ${entry} honestly`)).toBe(false);
      expect(isTextAllowed(entry.toUpperCase())).toBe(false);
      expect(isTextAllowed(`${entry}!!!`)).toBe(false);
    }
  });
});

describe('what it catches', () => {
  it('sees through capitals, punctuation and extra space', () => {
    expect(isTextAllowed('What the SHIT')).toBe(false);
    expect(isTextAllowed('shit.')).toBe(false);
    expect(isTextAllowed('"shit"')).toBe(false);
    expect(isTextAllowed('so   much   shit   today')).toBe(false);
    expect(isTextAllowed('line one\nshit\nline three')).toBe(false);
  });

  it('sees through the usual letter swaps', () => {
    expect(isTextAllowed('sh1t')).toBe(false);
    expect(isTextAllowed('5h1t')).toBe(false);
    expect(isTextAllowed('a$$hole')).toBe(false);
    expect(isTextAllowed('@sshole')).toBe(false);
  });

  it('sees through stretched letters', () => {
    expect(isTextAllowed('fuuuuck')).toBe(false);
    expect(isTextAllowed('shiiiit')).toBe(false);
    expect(isTextAllowed('bitchhhh')).toBe(false);
  });

  it('sees through accents', () => {
    expect(isTextAllowed('FÜCK')).toBe(false);
    expect(isTextAllowed('shït')).toBe(false);
  });

  it('catches a phrase however it is spaced or punctuated, and with the apostrophe left out or in', () => {
    expect(isTextAllowed('just kill yourself')).toBe(false);
    expect(isTextAllowed('kill-yourself')).toBe(false);
    expect(isTextAllowed('Kill   YOURSELF.')).toBe(false);
    expect(isTextAllowed("I'll kill you")).toBe(false);
    expect(isTextAllowed('ill kill you')).toBe(false);
    expect(isTextAllowed('I will kill you')).toBe(false);
  });

  it('says which entry it found', () => {
    expect(findBlockedWord('what a load of bullshit')).toBe('bullshit');
    expect(findBlockedWord('just kill yourself')).toBe('kill yourself');
  });

  it('reads the whole text, however long, and finds the word at the end', () => {
    expect(isTextAllowed(`${'a perfectly nice sentence about running. '.repeat(50)}shit`)).toBe(false);
  });
});

describe('what it leaves alone', () => {
  it.each([
    'Hit a new 5K PR this morning!',
    'Leg day was brutal. 4 sets of 10, 225 lb.',
    "I'll kill it at the gym tomorrow",
    'Time to kill your goals',
    'Run Scunthorpe parkrun',
    'A great class, I would assess it a 9',
    'Passionate about my classic mileage',
    'Sussex hills at 6am',
    'Eating shiitake and rice after the long run',
    '5 10 15 20',
    '5k, 10k, 21.1k',
    'Cooldown: 2 mi easy 😅',
    '',
    '   ',
  ])('allows %j', (text) => {
    expect(isTextAllowed(text)).toBe(true);
    expect(findBlockedWord(text)).toBeNull();
  });

  it('allows nothing at all, and things that are not text', () => {
    expect(isTextAllowed(null)).toBe(true);
    expect(isTextAllowed(undefined)).toBe(true);
    expect(isTextAllowed(42)).toBe(true);
    expect(findBlockedWord(undefined)).toBeNull();
  });

  it('leaves a number with a k alone, and does not turn digits into letters unless the word has a letter in it', () => {
    expect(normalizeWords('5k')).toBe('sk');
    expect(normalizeWords('5 10')).toBe('5 10');
  });
});

describe('a list of its own', () => {
  it('can be given another list, for a test or a second use', () => {
    expect(isTextAllowed('banana split', ['banana'])).toBe(false);
    expect(isTextAllowed('shit', ['banana'])).toBe(true);
  });
});

describe('the error', () => {
  it('has a code to tell it by, and nothing else is mistaken for it', () => {
    const e = contentNotAllowedError();
    expect(e.code).toBe(CONTENT_NOT_ALLOWED);
    expect(isContentNotAllowed(e)).toBe(true);
    expect(isContentNotAllowed(new Error('no'))).toBe(false);
    expect(isContentNotAllowed({ code: 'permission-denied' })).toBe(false);
    expect(isContentNotAllowed(null)).toBe(false);
    expect(isContentNotAllowed(undefined)).toBe(false);
  });

  it('is told to the person in plain words, with no technical details and without repeating the word', () => {
    const message = postErrorMessage(contentNotAllowedError(), false);
    expect(message).toBe(NOT_ALLOWED_MESSAGE);
    expect(postErrorMessage(contentNotAllowedError(), true)).toBe(NOT_ALLOWED_MESSAGE);
    expect(message).not.toMatch(/content\/not-allowed|Error/);
  });

  it('leaves the messages for other errors as they were', () => {
    expect(postErrorMessage({ code: 'storage/unauthorized' }, true)).toMatch(/^Couldn't upload your post\./);
    expect(postErrorMessage({ code: 'unavailable', message: 'offline' }, false)).toMatch(/^Couldn't post right now\./);
  });
});
