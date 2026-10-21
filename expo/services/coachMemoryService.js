// services/coachMemoryService.js
//
// The Coach's long-term memory (lib/coachMemory.js) in the person's own account: users/{uid}/data/coachMemory, which the rules let only that
// person read and write and which is erased with the rest of the account. The Coach screen refreshes it when it opens, from the chat
// messages the Coach has not looked at yet; the memory screen reads it, removes a note, forgets everything or pauses it.
//
// Loading and refreshing never throw: a memory that cannot be had is an empty one, and the Coach carries on without it. Changes made from the
// memory screen (remove, forget, pause) do throw when they cannot be saved, so the screen can say so rather than show a list that is not true.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { generateCoachMemory } from './aiService';
import {
  MEMORY_DOC, readMemory, saveableMemory, removeFactAt, forgottenMemory, newMessages, worthLearning, buildMemoryMessages,
} from '../lib/coachMemory';

// What each person's memory was the last time this phone read or saved it, so the Coach can use it on every message without a read each time.
const known = new Map();
// Refreshes under way, by person: opening the Coach twice in a row does not ask the AI twice.
const refreshing = new Map();

const memoryRef = (uid) => doc(db, 'users', uid, 'data', MEMORY_DOC);

/** The memory this phone last saw for the person, or an empty one. Reads nothing. */
export const getCachedCoachMemory = (uid) => known.get(uid) || readMemory(null);

// The saved memory, read from the account. Throws when it cannot be read: a memory that is merely missing is an empty one, but a read that
// failed must never be taken for an empty memory, or the next save would write over notes that are really there.
async function readSaved(uid) {
  const snap = await getDoc(memoryRef(uid));
  const memory = readMemory(snap.exists() ? snap.data() : null);
  known.set(uid, memory);
  return memory;
}

/** The person's memory as it is saved now. Never throws: when it cannot be read, what the phone last saw (or an empty memory). */
export async function loadCoachMemory(uid) {
  if (!uid) return readMemory(null);
  try {
    return await readSaved(uid);
  } catch (error) {
    console.warn('[coachMemory] could not read the memory:', error?.message);
    return getCachedCoachMemory(uid);
  }
}

async function save(uid, memory) {
  const data = saveableMemory(memory);
  await setDoc(memoryRef(uid), data);
  known.set(uid, data);
  return data;
}

/** Removes the note at `index` from the saved list. Resolves to the memory now saved; throws if it could not be read or saved. */
export async function removeCoachNote(uid, index) {
  const memory = await readSaved(uid);
  return save(uid, { ...memory, facts: removeFactAt(memory.facts, index), updatedAt: Date.now() });
}

/** Forgets every note, and counts the chat up to now as looked at. Resolves to the memory now saved; throws if it could not be saved. */
export async function forgetCoachMemory(uid) {
  return save(uid, forgottenMemory(await readSaved(uid)));
}

/**
 * Pauses or resumes the memory: paused, the Coach neither adds to the notes nor uses them. The notes stay. Resuming counts the chat up to now
 * as looked at, so what was said while it was paused is not noted afterwards. Throws if it could not be saved.
 */
export async function setCoachMemoryPaused(uid, paused) {
  const memory = await readSaved(uid);
  const now = Date.now();
  return save(uid, { ...memory, paused: paused === true, upTo: paused === true ? memory.upTo : now, updatedAt: now });
}

/**
 * Updates the notes from the chat messages the Coach has not looked at yet. `history` is the person's chat as getCoachHistory gives it. Looks
 * only when the memory is not paused and the person has said enough since the last look; the AI's answer is put in place only if the memory has
 * not been changed in the meantime (a note removed, everything forgotten, a pause), since a slow answer must not undo what the person just did.
 * Resolves to the memory as it stands, and never rejects: a memory that could not be read or saved leaves the notes as they are. `ask` and `now`
 * are only there so a test can stand in for the AI and the clock.
 */
export function refreshCoachMemory({ uid, history, ask = generateCoachMemory, now = Date.now() }) {
  if (!uid) return Promise.resolve(readMemory(null));
  if (refreshing.has(uid)) return refreshing.get(uid);
  const work = (async () => {
    const memory = await readSaved(uid);
    if (memory.paused) return memory;
    const messages = newMessages(history, memory.upTo);
    if (!worthLearning(messages)) return memory;

    const facts = await ask({ messages: buildMemoryMessages({ facts: memory.facts, messages }), current: memory.facts });
    // Nothing usable: nothing is saved, so the same messages are looked at again the next time the Coach opens.
    if (!facts) return memory;

    const latest = await readSaved(uid);
    if (latest.paused || latest.upTo !== memory.upTo || latest.updatedAt !== memory.updatedAt) return latest;
    return save(uid, { facts, paused: false, upTo: messages[messages.length - 1].at, updatedAt: now });
  })().catch((error) => {
    // Whatever went wrong (a read, the AI, a save), the notes are as they were; the same messages are looked at again next time.
    console.warn('[coachMemory] could not update the notes:', error?.message);
    return getCachedCoachMemory(uid);
  }).finally(() => { refreshing.delete(uid); });
  refreshing.set(uid, work);
  return work;
}
