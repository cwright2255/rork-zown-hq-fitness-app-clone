// The Coach's notes in the Coach's instructions (services/coachService.js buildCoachSystemPrompt, lib/coachMemory.js memoryLine).
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
  serverTimestamp: jest.fn(), doc: jest.fn(), setDoc: jest.fn(), getDoc: jest.fn(),
}), { virtual: true });

import { buildCoachSystemPrompt } from '../services/coachService';
import { memoryLine } from '../lib/coachMemory';

const NOW = new Date(2026, 9, 7, 9, 0, 0);
const user = { name: 'Sam', fitnessLevel: 'intermediate', fitnessMetrics: {} };
const MEMORY = { facts: ['Can train 3 days a week', 'Trains at home with dumbbells'], paused: false };

describe('the Coach\'s instructions with its notes', () => {
  it('include what the person told it before, after what the profile says and before how to answer', () => {
    const text = buildCoachSystemPrompt(user, NOW, { memory: MEMORY }).content;
    const line = memoryLine(MEMORY);
    expect(text).toContain(line);
    expect(text).toContain('Can train 3 days a week; Trains at home with dumbbells.');
    expect(text).toContain('Fitness level: intermediate.');
    expect(text.indexOf('Fitness level: intermediate.')).toBeLessThan(text.indexOf(line));
    expect(text.indexOf(line)).toBeLessThan(text.indexOf('Be encouraging, specific, and concise.'));
  });

  it('are the same as before when there are no notes', () => {
    const plain = buildCoachSystemPrompt(user, NOW).content;
    for (const memory of [undefined, null, { facts: [], paused: false }, { facts: ['A'], paused: true }]) {
      expect(buildCoachSystemPrompt(user, NOW, { memory }).content).toBe(plain);
    }
    expect(plain).not.toMatch(/earlier chats/);
  });

  it('are not changed in any other way by the notes', () => {
    const plain = buildCoachSystemPrompt(user, NOW).content;
    const withNotes = buildCoachSystemPrompt(user, NOW, { memory: MEMORY }).content;
    expect(withNotes.replace(` ${memoryLine(MEMORY)}`, '')).toBe(plain);
  });

  it('work with the calendar option', () => {
    const off = buildCoachSystemPrompt(user, NOW, { calendar: false, memory: MEMORY }).content;
    expect(off).toContain('Can train 3 days a week');
    expect(off).not.toContain('{"type":"schedule"');
  });
});
