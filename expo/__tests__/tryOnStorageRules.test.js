// The storage rule for the try-on's garment files (storage.rules): any signed-in person can read them, nobody can write them from the app, and nothing else in
// the rules opens that folder. This reads the rules file itself, because the Storage emulator is not part of the jest run (the Firestore rules have their own
// emulator tests in rules-tests/).
const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8');

// The text of the `match` block that starts with `header` (up to its closing brace), or null.
function blockOf(header) {
  const start = rules.indexOf(header);
  if (start < 0) return null;
  let depth = 0;
  for (let i = rules.indexOf(' {\n', start) + 1; i < rules.length; i++) { // the block opens at the end of the match line (the path has braces of its own)
    if (rules[i] === '{') depth++;
    if (rules[i] === '}') { depth--; if (depth === 0) return rules.slice(start, i + 1); }
  }
  return null;
}

describe('the try-on files in storage.rules', () => {
  const block = blockOf('match /tryon-packs/');

  it('has a rule for tryon-packs, and it covers every file below the version folder', () => {
    expect(block).not.toBeNull();
    expect(block).toMatch(/match \/tryon-packs\/\{version\}\/\{allPaths=\*\*\}/);
  });

  it('lets only a signed-in person read', () => {
    expect(block).toMatch(/allow read: if request\.auth != null;/);
  });

  it('lets nobody write', () => {
    expect(block).toMatch(/allow write: if false;/);
    expect(block).not.toMatch(/allow (create|update|delete)/);
  });

  it('is the only rule that mentions tryon-packs', () => {
    expect(rules.match(/match \/tryon-packs/g)).toHaveLength(1);
    expect(rules).not.toMatch(/match \/\{allPaths=\*\*\}/); // no catch-all that could open it
  });

  it('is inside the bucket\'s rules, which are still the ones the app had', () => {
    expect(rules).toMatch(/match \/b\/\{bucket\}\/o \{/);
    for (const kept of ['match /users/{userId}/profile/{fileName}', 'match /users/{userId}/media/{fileName}', 'match /posts/{userId}/{postId}/{fileName}']) expect(rules).toContain(kept);
  });
});
