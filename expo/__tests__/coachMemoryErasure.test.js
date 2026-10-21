// The Coach's notes are part of the person's account: they live under users/{uid}, which deleting the account erases in one recursive delete
// (functions/src/accountErasure.js), and the rules let only that person read and write them. If the notes were ever moved somewhere else, the
// privacy policy's promise (they are erased with the account) would stop being true, and this fails.
import fs from 'fs';
import path from 'path';
import { MEMORY_DOC } from '../lib/coachMemory';

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('the Coach\'s notes and the rest of the account', () => {
  it('are kept at users/{uid}/data/coachMemory, which the service reads and writes', () => {
    const service = read('services/coachMemoryService.js');
    expect(MEMORY_DOC).toBe('coachMemory');
    expect(service).toContain("doc(db, 'users', uid, 'data', MEMORY_DOC)");
  });

  it('are erased with the account: deleting it removes users/{uid} and everything under it', () => {
    expect(read('functions/src/accountErasure.js')).toContain("db.recursiveDelete(db.doc(`users/${uid}`))");
  });

  it('can be read and written only by that person: the rule for users/{uid}/data/{doc} is owner-only', () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /data/{docId} {');
    expect(start).toBeGreaterThan(-1);
    const block = rules.slice(start, rules.indexOf('\n      }', start)); // up to this rule's closing brace
    expect(block).toContain('allow read, write: if request.auth != null && request.auth.uid == userId;');
  });
});
