// app/workout/create.jsx
//
// Retired: manual workout creation has been replaced by the AI-driven
// Quick Workout flow (app/workout/quick.jsx). Kept as a redirect rather
// than deleted outright, so any lingering reference to /workout/create
// still out there, visible or not, lands on the real replacement flow
// instead of a broken "unmatched route" screen or the retired UI.
import { Redirect } from 'expo-router';

export default function CreateWorkoutRedirect() {
  return <Redirect href="/workout/quick" />;
}
