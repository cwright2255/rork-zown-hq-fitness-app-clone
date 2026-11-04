// What VoiceOver says for the middle button of the workout's control pill (lib/centerButtonLabel.js): it is only an icon, and what it does
// changes with the exercise, so the label has to change too.
import fs from 'fs';
import path from 'path';
import { centerButtonLabel } from '../lib/centerButtonLabel';

describe('the middle button of the workout controls', () => {
  it('starts the timer when it is stopped, and pauses it while it runs', () => {
    expect(centerButtonLabel(false, false, false)).toBe('Start timer');
    expect(centerButtonLabel(false, false, true)).toBe('Pause timer');
  });

  it('moves on to the next exercise once this one is done', () => {
    expect(centerButtonLabel(false, true, false)).toBe('Next exercise');
    expect(centerButtonLabel(false, true, true)).toBe('Next exercise');
  });

  it('finishes the workout on the last exercise once it is done, whatever the timer was doing', () => {
    expect(centerButtonLabel(true, true, false)).toBe('Finish workout');
    expect(centerButtonLabel(true, true, true)).toBe('Finish workout');
  });

  it('says something different for each thing the button does, so none is mistaken for another', () => {
    const said = [
      centerButtonLabel(false, false, false),
      centerButtonLabel(false, false, true),
      centerButtonLabel(false, true, false),
      centerButtonLabel(true, true, false),
    ];
    expect(new Set(said).size).toBe(4);
  });
});

describe('the workout screen', () => {
  const active = fs.readFileSync(path.join(__dirname, '..', 'app/workout/active.jsx'), 'utf8');

  it('reads the label from the three facts the button already acts on', () => {
    expect(active).toContain("import { centerButtonLabel } from '@/lib/centerButtonLabel';");
    expect(active).toContain('accessibilityLabel={centerButtonLabel(isWorkoutDone, exerciseComplete, isPlaying)}');
  });
});
