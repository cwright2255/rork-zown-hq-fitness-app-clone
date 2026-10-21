// firestore.rules is read as text, because the emulator is not part of the test run: this
// checks that a finished fast can only be read and written by the person it belongs to.
const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

// The text of the { ... } block that starts at `header`, braces matched.
function block(src, header) {
  const start = src.indexOf(header);
  if (start === -1) return null;
  const open = src.indexOf('{', start + header.length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

describe('the rules for the Fasting widget', () => {
  const users = block(rules, 'match /users/{userId}');
  const history = users && block(users, 'match /fastingHistory/{fastId}');

  it('has a fastingHistory rule inside users/{userId}', () => {
    expect(users).toBeTruthy();
    expect(history).toBeTruthy();
  });

  it('lets only the signed in owner read, create, update and delete a finished fast', () => {
    const allows = history.match(/allow [^;\n]*/g);
    expect(allows).toEqual(['allow read, create, update, delete: if request.auth != null && request.auth.uid == userId']);
  });

  it('does not open anything up to everyone', () => {
    expect(history).not.toMatch(/if\s+true/);
  });

  it('leaves the running fast to the existing data rule, which only the owner can use', () => {
    const data = block(users, 'match /data/{docId}');
    expect(data).toMatch(/allow read: if request\.auth != null && request\.auth\.uid == userId;/);
    expect(data).toMatch(/allow write: if request\.auth != null && request\.auth\.uid == userId &&/);
    expect(data).not.toMatch(/'fasting'/); // the running fast is not one of the documents the server writes
  });
});
