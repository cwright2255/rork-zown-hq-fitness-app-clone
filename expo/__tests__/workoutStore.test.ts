import { useWorkoutStore } from '../src/stores/workoutStore';
import type { Workout } from '../src/types/firestore';

const w: Workout = {
  id: 'w1',
  userId: 'u1',
  name: 'Upper',
  exercises: [],
  duration: 30,
  date: new Date(),
  aiGenerated: false,
  completed: false,
};

describe('workoutStore', () => {
  beforeEach(() => useWorkoutStore.getState().reset());

  it('adds a workout', () => {
    useWorkoutStore.getState().addWorkout(w);
    expect(useWorkoutStore.getState().workouts).toHaveLength(1);
  });

  it('updates a workout', () => {
    useWorkoutStore.getState().addWorkout(w);
    useWorkoutStore.getState().updateWorkout('w1', { name: 'Lower' });
    expect(useWorkoutStore.getState().workouts[0].name).toBe('Lower');
  });

  it('removes a workout', () => {
    useWorkoutStore.getState().addWorkout(w);
    useWorkoutStore.getState().removeWorkout('w1');
    expect(useWorkoutStore.getState().workouts).toHaveLength(0);
  });
});
