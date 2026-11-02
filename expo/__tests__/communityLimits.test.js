// How long a post, a comment and a message can be. The rules (firestore.rules) refuse anything longer, and the screens stop typing at
// the same numbers (lib/communityLimits.js), so nobody types a long message and finds it refused when they press send.
const fs = require('fs');
const path = require('path');
const {
  MAX_POST_LENGTH, MAX_COMMENT_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_PICTURE_LENGTH,
} = require('../lib/communityLimits');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const rules = read('firestore.rules');

describe('the limits', () => {
  it('are the ones the rules say', () => {
    expect(MAX_POST_LENGTH).toBe(2000);
    expect(MAX_COMMENT_LENGTH).toBe(1000);
    expect(MAX_MESSAGE_LENGTH).toBe(2000);
    expect(MAX_NAME_LENGTH).toBe(100);
    expect(MAX_PICTURE_LENGTH).toBe(2000);
  });

  it('appear in the rules as the same numbers, in the place each one applies', () => {
    // a post
    expect(rules).toMatch(new RegExp(`d\\.text is string && d\\.text\\.size\\(\\) <= ${MAX_POST_LENGTH}`));
    expect(rules).toMatch(new RegExp(`request\\.resource\\.data\\.text\\.size\\(\\) <= ${MAX_POST_LENGTH}\\)\\);`)); // an edit of a post
    expect(rules).toMatch(new RegExp(`d\\.authorAvatar\\.size\\(\\) <= ${MAX_PICTURE_LENGTH}`));
    // a comment
    expect(rules).toMatch(new RegExp(`d\\.text is string && d\\.text\\.size\\(\\) <= ${MAX_COMMENT_LENGTH}`));
    // the name on a post and a comment
    expect(rules.match(new RegExp(`d\\.authorName\\.size\\(\\) <= ${MAX_NAME_LENGTH}`, 'g'))).toHaveLength(2);
    // a message, and the copy of the last one kept on the conversation
    expect(rules).toMatch(new RegExp(`request\\.resource\\.data\\.text\\.size\\(\\) <= ${MAX_MESSAGE_LENGTH} &&`));
    expect(rules).toMatch(new RegExp(`last\\.get\\('text', ''\\)\\.size\\(\\) <= ${MAX_MESSAGE_LENGTH}`));
  });

  it('are not written any other way in the rules: no other length is set for a post, comment or message', () => {
    const posts = rules.slice(rules.indexOf('match /communityPosts/{postId}'), rules.indexOf('// Reports of a post'));
    const lengths = [...posts.matchAll(/size\(\) <= (\d+)/g)].map((m) => Number(m[1]));
    expect(new Set(lengths)).toEqual(new Set([MAX_POST_LENGTH, MAX_COMMENT_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_PICTURE_LENGTH]));
  });
});

describe('the screens stop typing at the limit', () => {
  it('in the box for a new post', () => {
    expect(read('components/PostComposer.jsx')).toMatch(/maxLength=\{MAX_POST_LENGTH\}/);
    expect(read('components/PostComposer.jsx')).toMatch(/MAX_POST_LENGTH \} from '\.\.\/lib\/communityLimits'/);
  });

  it('in the box for editing a post, and the box for a comment, on the Social screen', () => {
    const social = read('app/social.jsx');
    expect(social).toMatch(/maxLength=\{MAX_POST_LENGTH\}/);
    expect(social).toMatch(/maxLength=\{MAX_COMMENT_LENGTH\}/);
  });

  it('in the box for a comment on the Community screen', () => {
    expect(read('app/community.jsx')).toMatch(/maxLength=\{MAX_COMMENT_LENGTH\}/);
  });

  it('in the box for a message', () => {
    expect(read('app/messages/[id].jsx')).toMatch(/maxLength=\{MAX_MESSAGE_LENGTH\}/);
  });

  it('and the stores turn away anything longer that gets past a screen', () => {
    expect(read('store/communityStore.js')).toMatch(/clean\.length > MAX_POST_LENGTH/);
    expect(read('store/communityStore.js')).toMatch(/text\.trim\(\)\.length > MAX_COMMENT_LENGTH/);
    expect(read('store/messagingStore.js')).toMatch(/text\.trim\(\)\.length > MAX_MESSAGE_LENGTH/);
  });
});

describe('the rules for the counts', () => {
  it('let no one write a like, comment or share count: the only mention of them is that a new post starts at zero', () => {
    const posts = rules.slice(rules.indexOf('match /communityPosts/{postId}'), rules.indexOf('// NEW: store/messagingStore.js'));
    const code = posts.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(code.match(/\b(like|comment|share)Count\b/g)).toHaveLength(3);
    expect(code).toMatch(/d\.likeCount == 0 && d\.commentCount == 0 && d\.shareCount == 0/);
    expect(code).not.toMatch(/hasOnly\(\['likeCount'/);
  });

  it('let only the author change a post, and only its text, edit time and three settings', () => {
    expect(rules).toMatch(/allow update: if request\.auth != null && request\.auth\.uid == resource\.data\.authorId && validPostEdit\(\);/);
    expect(rules).toMatch(/changed\.hasOnly\(\['text', 'editedAt', 'likesHidden', 'shareCountHidden', 'commentsDisabled'\]\)/);
  });
});

// The text of one rules function, from its name to its closing brace.
const functionBody = (name) => {
  const start = rules.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const rest = rules.slice(start);
  return rest.slice(0, rest.search(/\n\s*\}\n/));
};

describe('the rules for the name and picture', () => {
  it('take them from the person\'s own profile: users/{uid}, name and profileImage', () => {
    const name = functionBody('publicName');
    expect(name).toMatch(/get\(\/databases\/\$\(database\)\/documents\/users\/\$\(uid\)\)\.data\.get\('name', ''\)/);
    expect(name).toMatch(/'Zown User'/);
    const image = functionBody('publicImage');
    expect(image).toMatch(/get\(\/databases\/\$\(database\)\/documents\/users\/\$\(uid\)\)\.data\.get\('profileImage', null\)/);
  });

  it('hold a new post to them: its authorName and authorAvatar must be the profile\'s', () => {
    const post = functionBody('validNewPost');
    expect(post).toMatch(/d\.authorName == publicName\(uid\)/);
    expect(post).toMatch(/d\.get\('authorAvatar', null\) == publicImage\(uid\)/);
  });

  it('hold a new comment to the name, and to exactly four fields', () => {
    const comment = functionBody('validNewComment');
    expect(comment).toMatch(/d\.authorName == publicName\(uid\)/);
    expect(comment).toMatch(/d\.keys\(\)\.hasOnly\(\['authorId', 'authorName', 'text', 'createdAt'\]\)/);
  });

  it('hold the writer\'s own entry on a conversation to them, whenever participantInfo is created or changed', () => {
    const info = functionBody('ownInfoMatches');
    expect(info).toMatch(/d\.participantInfo\[uid\]\.get\('name', ''\) == publicName\(uid\)/);
    expect(info).toMatch(/d\.participantInfo\[uid\]\.get\('avatar', null\) == publicImage\(uid\)/);
    const conversations = rules.slice(rules.indexOf('match /conversations/{conversationId}'), rules.indexOf('match /messages/{messageId}'));
    expect(conversations).toMatch(/lastMessageOk\(\)\)\s+&&\s+ownInfoMatches\(\);/);
    expect(conversations).toMatch(/hasAny\(\['participantInfo'\]\) \|\| ownInfoMatches\(\)\)/);
  });
});

describe('the rules for shares', () => {
  it('let a person read and make only their own mark, once, and never change it or take it back', () => {
    const shares = rules.slice(rules.indexOf('match /shares/{uid}'), rules.indexOf('match /comments/{commentId}'));
    expect(shares).toMatch(/allow read: if request\.auth != null && request\.auth\.uid == uid;/);
    expect(shares).toMatch(/allow create: if request\.auth != null && request\.auth\.uid == uid &&\s+request\.resource\.data\.keys\(\)\.hasOnly\(\['sharedAt'\]\);/);
    expect(shares).toMatch(/allow update, delete: if false;/);
  });
});
