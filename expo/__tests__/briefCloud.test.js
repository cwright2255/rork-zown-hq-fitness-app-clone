// services/briefCloud.js: the Today brief kept in the person's own account, users/{uid}/data/todayBrief, one document for the day it was
// written. Filing is one step, so the first brief filed for a day stands.
const mockDocs = {};
const mockRef = (path) => ({ path });
jest.mock('firebase/firestore', () => ({
  doc: (db, ...parts) => mockRef(parts.join('/')),
  getDoc: jest.fn(async (ref) => ({ exists: () => ref.path in mockDocs, data: () => mockDocs[ref.path] })),
  runTransaction: jest.fn(async (db, work) => work({
    get: async (ref) => ({ exists: () => ref.path in mockDocs, data: () => mockDocs[ref.path] }),
    set: (ref, data) => { mockDocs[ref.path] = data; },
  })),
}), { virtual: true });
jest.mock('../src/config/firebase', () => ({ db: { fake: true } }));

import { getDoc, runTransaction } from 'firebase/firestore';
import { readCloudBrief, fileCloudBrief } from '../services/briefCloud';

const PATH = 'users/u1/data/todayBrief';
const TEXT = JSON.stringify({ headline: 'A good day to train', points: ['Sleep was 8 hours.'] });
const OTHER = JSON.stringify({ headline: 'Ease off today', points: ['Your sleep was short.'] });

beforeEach(() => { for (const k of Object.keys(mockDocs)) delete mockDocs[k]; jest.clearAllMocks(); });

describe('reading the account\'s brief', () => {
  it('is the brief filed for that day', async () => {
    mockDocs[PATH] = { day: '2026-10-20', text: TEXT, at: 1 };
    expect(await readCloudBrief('u1', '2026-10-20')).toBe(TEXT);
  });

  it('is null when nothing is filed, when it is for another day, or when it is not a brief', async () => {
    expect(await readCloudBrief('u1', '2026-10-20')).toBeNull();
    mockDocs[PATH] = { day: '2026-10-19', text: TEXT, at: 1 };
    expect(await readCloudBrief('u1', '2026-10-20')).toBeNull();
    mockDocs[PATH] = { day: '2026-10-20', text: 'nothing useful', at: 1 };
    expect(await readCloudBrief('u1', '2026-10-20')).toBeNull();
  });

  it('throws when the account cannot be read, so a failed read is never taken for "nothing filed"', async () => {
    getDoc.mockRejectedValueOnce(new Error('unavailable'));
    await expect(readCloudBrief('u1', '2026-10-20')).rejects.toThrow('unavailable');
  });
});

describe('filing the account\'s brief', () => {
  it('files the brief for the day and says it stands', async () => {
    expect(await fileCloudBrief('u1', '2026-10-20', TEXT)).toBe(TEXT);
    expect(mockDocs[PATH]).toEqual({ day: '2026-10-20', text: TEXT, at: expect.any(Number) });
  });

  it('leaves a brief already filed for that day alone, and says that one stands', async () => {
    mockDocs[PATH] = { day: '2026-10-20', text: OTHER, at: 1 };
    expect(await fileCloudBrief('u1', '2026-10-20', TEXT)).toBe(OTHER);
    expect(mockDocs[PATH].text).toBe(OTHER);
  });

  it('replaces the brief of an earlier day with today\'s: one document, the latest day', async () => {
    mockDocs[PATH] = { day: '2026-10-19', text: OTHER, at: 1 };
    expect(await fileCloudBrief('u1', '2026-10-20', TEXT)).toBe(TEXT);
    expect(mockDocs[PATH]).toEqual({ day: '2026-10-20', text: TEXT, at: expect.any(Number) });
  });

  it('is one transaction, and throws when it cannot be made', async () => {
    runTransaction.mockRejectedValueOnce(new Error('unavailable'));
    await expect(fileCloudBrief('u1', '2026-10-20', TEXT)).rejects.toThrow('unavailable');
    expect(mockDocs[PATH]).toBeUndefined();
  });

  it('keeps each person\'s brief apart', async () => {
    await fileCloudBrief('u1', '2026-10-20', TEXT);
    await fileCloudBrief('u2', '2026-10-20', OTHER);
    expect(mockDocs['users/u1/data/todayBrief'].text).toBe(TEXT);
    expect(mockDocs['users/u2/data/todayBrief'].text).toBe(OTHER);
  });
});
