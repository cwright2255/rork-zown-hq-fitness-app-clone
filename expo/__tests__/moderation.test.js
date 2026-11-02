// The shared pieces of Report, Block and the Terms line (lib/moderation.js), and that they agree with the rules (firestore.rules).
const fs = require('fs');
const path = require('path');
const {
  REPORT_KINDS, REPORT_REASONS, REPORT_TEXT_MAX, NO_TOLERANCE_LINE, reportId, buildReport, isBlocked, withoutBlocked,
  canDeleteComment, postTarget, commentTarget, messageTarget, personTarget,
} = require('../lib/moderation');

// Only the rule for reports: other rules in the file have lists of their own that look the same.
const allRules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const rules = allRules.slice(allRules.indexOf('match /reports/{reportId}'), allRules.indexOf('match /admins/{uid}'));

describe('the app and the rules agree about a report', () => {
  const listAfter = (pattern) => {
    const match = rules.match(pattern);
    expect(match).not.toBeNull();
    return match[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
  };

  it('the reasons the app offers are the reasons the rules accept', () => {
    expect(REPORT_REASONS.map((r) => r.key).sort()).toEqual(listAfter(/d\.reason in \[([^\]]+)\]/).sort());
  });

  it('the kinds of thing that can be reported are the ones the rules accept', () => {
    expect(Object.keys(REPORT_KINDS).sort()).toEqual(listAfter(/d\.kind in \[([^\]]+)\]/).sort());
  });

  it('the copy of the text is cut to the length the rules allow', () => {
    expect(rules).toContain(`d.text.size() <= ${REPORT_TEXT_MAX}`);
  });

  it('every field of a report the app writes is one the rules allow, and the rules need all of the ones the app always writes', () => {
    const report = buildReport({
      reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'spam', text: 'hi',
    });
    const allowed = listAfter(/d\.keys\(\)\.hasOnly\(\[([^\]]+)\]\)/);
    const required = listAfter(/d\.keys\(\)\.hasAll\(\[([^\]]+)\]\)/);
    expect(allowed).toEqual(expect.arrayContaining(Object.keys(report)));
    expect(Object.keys(report)).toEqual(expect.arrayContaining(required));
  });

  it('the id of a report is the one the rules require', () => {
    expect(rules).toContain("id == d.reporterId + '_' + d.kind + '_' + d.targetId");
    expect(reportId('u1', 'comment', 'c9')).toBe('u1_comment_c9');
  });
});

describe('reasons', () => {
  it('each has a key and a label a person can read, and none is listed twice', () => {
    for (const reason of REPORT_REASONS) {
      expect(reason.key).toMatch(/^[a-z_]+$/);
      expect(reason.label.length).toBeGreaterThan(3);
    }
    expect(new Set(REPORT_REASONS.map((r) => r.key)).size).toBe(REPORT_REASONS.length);
  });

  it('end with "Something else", so there is always one that fits', () => {
    expect(REPORT_REASONS[REPORT_REASONS.length - 1].key).toBe('other');
  });
});

describe('buildReport', () => {
  const base = { reporterId: 'u1', kind: 'post', targetId: 'p1', targetPath: 'communityPosts/p1', targetAuthorId: 'u2', reason: 'harassment', text: 'Rude post' };

  it('is who reported, what, whose it is, why, a copy of the words, and when', () => {
    expect(buildReport({ ...base, now: '2026-10-29T12:00:00.000Z' })).toEqual({
      reporterId: 'u1',
      kind: 'post',
      targetId: 'p1',
      targetPath: 'communityPosts/p1',
      targetAuthorId: 'u2',
      reason: 'harassment',
      text: 'Rude post',
      createdAt: '2026-10-29T12:00:00.000Z',
    });
  });

  it('stamps the time itself when it is not given one, as text short enough for the rules', () => {
    const report = buildReport(base);
    expect(typeof report.createdAt).toBe('string');
    expect(report.createdAt.length).toBeLessThanOrEqual(40);
    expect(Number.isNaN(Date.parse(report.createdAt))).toBe(false);
  });

  it('leaves the copy out when there are no words (a post that is only a photo)', () => {
    expect('text' in buildReport({ ...base, text: '' })).toBe(false);
    expect('text' in buildReport({ ...base, text: '   ' })).toBe(false);
    expect('text' in buildReport({ ...base, text: undefined })).toBe(false);
  });

  it('cuts a long copy to what the rules allow, and trims it', () => {
    expect(buildReport({ ...base, text: `  ${'x'.repeat(5000)}  ` }).text).toHaveLength(REPORT_TEXT_MAX);
  });

  it('turns ids into text, and has an empty author when there is none (the rules want text there)', () => {
    const report = buildReport({ ...base, targetId: 12, targetAuthorId: undefined });
    expect(report.targetId).toBe('12');
    expect(report.targetAuthorId).toBe('');
  });

  it.each([
    ['no reporter', { reporterId: '' }],
    ['no kind', { kind: undefined }],
    ['a kind that cannot be reported', { kind: 'user' }],
    ['no thing', { targetId: '' }],
    ['no place for it', { targetPath: '' }],
    ['no reason', { reason: undefined }],
    ['a reason that is not offered', { reason: 'rude' }],
  ])('is nothing with %s', (_, over) => {
    expect(buildReport({ ...base, ...over })).toBeNull();
  });
});

describe('who is blocked', () => {
  const blocked = { u2: { uid: 'u2', name: 'Dana' } };

  it('says whether a person is on the list', () => {
    expect(isBlocked(blocked, 'u2')).toBe(true);
    expect(isBlocked(blocked, 'u3')).toBe(false);
    expect(isBlocked(blocked, '')).toBe(false);
    expect(isBlocked(blocked, undefined)).toBe(false);
    expect(isBlocked(undefined, 'u2')).toBe(false);
  });

  it('is not fooled by a name that every object has', () => {
    expect(isBlocked({}, 'constructor')).toBe(false);
    expect(isBlocked({}, 'toString')).toBe(false);
    expect(isBlocked({}, '__proto__')).toBe(false);
  });

  it('takes the posts and comments of blocked people out, and keeps the order of the rest', () => {
    const items = [{ id: 1, authorId: 'u1' }, { id: 2, authorId: 'u2' }, { id: 3, authorId: 'u3' }, { id: 4, authorId: 'u2' }];
    expect(withoutBlocked(items, blocked).map((i) => i.id)).toEqual([1, 3]);
  });

  it('can be told whose each one is (the other person in a conversation, a person in a list)', () => {
    const conversations = [{ id: 'a', otherUid: 'u2' }, { id: 'b', otherUid: 'u9' }];
    expect(withoutBlocked(conversations, blocked, (c) => c.otherUid).map((c) => c.id)).toEqual(['b']);
  });

  it('gives the same list back when nobody is blocked, and an empty one for anything that is not a list', () => {
    const items = [{ id: 1, authorId: 'u1' }];
    expect(withoutBlocked(items, {})).toBe(items);
    expect(withoutBlocked(items, undefined)).toBe(items);
    expect(withoutBlocked(undefined, blocked)).toEqual([]);
    expect(withoutBlocked(null, {})).toEqual([]);
  });
});

describe('who can delete a comment', () => {
  const post = { id: 'p1', authorId: 'owner' };
  const comment = { id: 'c1', authorId: 'writer' };

  it('its author can, and the owner of the post it is on can', () => {
    expect(canDeleteComment({ comment, post, myUid: 'writer' })).toBe(true);
    expect(canDeleteComment({ comment, post, myUid: 'owner' })).toBe(true);
  });

  it('nobody else can, and nobody can when nobody is signed in', () => {
    expect(canDeleteComment({ comment, post, myUid: 'stranger' })).toBe(false);
    expect(canDeleteComment({ comment, post, myUid: undefined })).toBe(false);
    expect(canDeleteComment({ comment: undefined, post, myUid: 'owner' })).toBe(false);
    expect(canDeleteComment({ comment, post: undefined, myUid: 'owner' })).toBe(false);
  });
});

describe('what the sheet is opened with', () => {
  it('a post', () => {
    expect(postTarget({ id: 'p1', authorId: 'u2', authorName: 'Dana', authorAvatar: 'a.png', text: 'Hi' })).toEqual({
      kind: 'post', id: 'p1', path: 'communityPosts/p1', authorId: 'u2', authorName: 'Dana', authorAvatar: 'a.png', text: 'Hi', canDelete: false,
    });
    expect(postTarget({ id: 'p1', authorId: 'u2', authorName: 'Dana' })).toMatchObject({ authorAvatar: null, text: '' });
  });

  it('a comment, with whether this person can remove it', () => {
    const post = { id: 'p1', authorId: 'owner' };
    const comment = { id: 'c1', authorId: 'writer', authorName: 'Wes', text: 'Nice' };
    expect(commentTarget({ post, comment, myUid: 'owner' })).toEqual({
      kind: 'comment', id: 'c1', path: 'communityPosts/p1/comments/c1', postId: 'p1', authorId: 'writer', authorName: 'Wes', authorAvatar: null,
      text: 'Nice', canDelete: true,
    });
    expect(commentTarget({ post, comment, myUid: 'stranger' }).canDelete).toBe(false);
  });

  it('a message, and a person', () => {
    expect(messageTarget({ conversationId: 'a_b', message: { id: 'm1', senderId: 'b', text: 'yo' }, otherName: 'Bea', otherAvatar: '' })).toEqual({
      kind: 'message', id: 'm1', path: 'conversations/a_b/messages/m1', authorId: 'b', authorName: 'Bea', authorAvatar: null, text: 'yo', canDelete: false,
    });
    expect(personTarget({ uid: 'b', name: 'Bea', avatar: 'b.png' })).toEqual({
      kind: 'person', id: 'b', path: 'users/b', authorId: 'b', authorName: 'Bea', authorAvatar: 'b.png', text: '', canDelete: false,
    });
    expect(REPORT_KINDS.person).toBeUndefined(); // a person is blocked, not reported
  });
});

describe('the no-tolerance line', () => {
  it('says there is no tolerance for objectionable content or abusive users', () => {
    expect(NO_TOLERANCE_LINE).toMatch(/no tolerance for objectionable content or abusive users/);
  });

  it('says what happens, and that reporting and blocking are there', () => {
    expect(NO_TOLERANCE_LINE).toMatch(/removed/);
    expect(NO_TOLERANCE_LINE).toMatch(/report/);
    expect(NO_TOLERANCE_LINE).toMatch(/block/);
  });

  it('is said the same way in the Terms of Service the line points to', () => {
    const terms = fs.readFileSync(path.join(__dirname, '..', 'app', 'profile', 'terms.jsx'), 'utf8');
    expect(terms).toMatch(/no tolerance for objectionable content or abusive users/);
  });
});
