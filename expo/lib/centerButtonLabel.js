// lib/centerButtonLabel.js
//
// What the middle button of the control pill on the active workout screen (app/workout/active.jsx) does right now, said out loud for
// VoiceOver. The button is only an icon, and the icon changes with the state, so the spoken label has to change with it.
//
// - On the last exercise, once it is done, the button saves and finishes the workout.
// - Once any other exercise is done, it moves on to the next one.
// - Otherwise it starts or pauses the exercise timer.

/** The spoken label for the middle button, given the same three facts the screen already works out. */
export function centerButtonLabel(isWorkoutDone, exerciseComplete, isPlaying) {
  if (isWorkoutDone) return 'Finish workout';
  if (exerciseComplete) return 'Next exercise';
  return isPlaying ? 'Pause timer' : 'Start timer';
}
