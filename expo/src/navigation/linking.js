export const linking = {
  prefixes: ['zownhq://', 'https://zownhq.app'],
  config: {
    screens: {
      workout: 'workout/:workoutId',
      'ai-coach': 'ai-coach/:recommendationId',
      profile: 'profile',
    },
  },
};

export const makeWorkoutDeepLink = (workoutId) =>
  `zownhq://workout/${workoutId}`;

export const makeAIDeepLink = (recommendationId) =>
  `zownhq://ai-coach/${recommendationId}`;
