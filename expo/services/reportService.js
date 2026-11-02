// services/reportService.js
//
// Reporting a post, a comment or a message. A report is one document in `reports` (firestore.rules): who reported, what and whose it
// is, why, and when. The app can only add one; nobody can read it back from a phone. It is read in the Firebase console
// (Firestore Database, then reports), where `targetPath` says where the thing is, and `text` is a copy of what it said.
//
// The document is named `<reporter>_<kind>_<id of the thing>`, so a person reports a thing once. Reporting it a second time is
// refused by the rules, so this remembers what was reported in this session and says so without asking the database.
import { db } from '../src/config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { buildReport, reportId } from '../lib/moderation';

const sent = new Set();

/** For tests: forget what was reported in this session. */
export function forgetSentReports() {
  sent.clear();
}

/**
 * Files a report. Resolves to { status: 'sent' } or { status: 'already' } (this phone reported it earlier in this session).
 * Throws when the report is incomplete or the database refuses it (a report filed before on another phone is refused too).
 */
export async function submitReport({ reporterId, kind, targetId, targetPath, targetAuthorId, reason, text }) {
  const report = buildReport({ reporterId, kind, targetId, targetPath, targetAuthorId, reason, text });
  if (!report) throw new Error('This report is missing something.');
  const id = reportId(report.reporterId, report.kind, report.targetId);
  if (sent.has(id)) return { status: 'already' };
  try {
    await setDoc(doc(db, 'reports', id), report);
  } catch (e) {
    console.warn('[reportService] could not file the report:', e?.code, e?.message);
    throw e;
  }
  sent.add(id);
  return { status: 'sent' };
}
