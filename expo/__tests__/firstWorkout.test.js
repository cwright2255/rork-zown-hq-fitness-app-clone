// lib/firstWorkout.js: whether the workout being finished is the first one the person has finished all the way, for the
// first_workout_completed analytics event.
import { isFirstFinishedWorkout } from '../lib/firstWorkout';

const finished = (extra = {}) => ({ id: 'w1', name: 'Push Day', exercisesCompleted: 4, totalExercises: 4, completed: true, ...extra });
const partial = (extra = {}) => ({ id: 'w2', name: 'Leg Day', exercisesCompleted: 1, totalExercises: 5, partial: true, completed: false, ...extra });

describe('isFirstFinishedWorkout', () => {
  it('is true when nothing has been saved yet', () => {
    expect(isFirstFinishedWorkout([])).toBe(true);
  });

  it('is false once a workout has been finished', () => {
    expect(isFirstFinishedWorkout([finished()])).toBe(false);
  });

  it('is still true when the only workout saved so far was left part-way', () => {
    expect(isFirstFinishedWorkout([partial()])).toBe(true);
    expect(isFirstFinishedWorkout([partial(), partial({ id: 'w3' })])).toBe(true);
  });

  it('is false when a finished workout sits among part-way ones', () => {
    expect(isFirstFinishedWorkout([partial(), finished(), partial({ id: 'w3' })])).toBe(false);
  });

  it('counts an older record that has no completed or partial field as finished', () => {
    expect(isFirstFinishedWorkout([{ id: 'old', name: 'Old workout' }])).toBe(false);
  });

  it('copes with a history that is missing, not a list, or has holes', () => {
    expect(isFirstFinishedWorkout(undefined)).toBe(true);
    expect(isFirstFinishedWorkout(null)).toBe(true);
    expect(isFirstFinishedWorkout({})).toBe(true);
    expect(isFirstFinishedWorkout([null, undefined])).toBe(true);
    expect(isFirstFinishedWorkout([null, finished()])).toBe(false);
  });
});
