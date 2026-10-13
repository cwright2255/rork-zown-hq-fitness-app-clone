// lib/raceMessages.js
//
// What the run screen says when a virtual race is finished, written and spoken.
// `result` is what services/raceBoard.js returns:
//   { status: 'finished', timeSec, bestSec, first, improved, posted }
//       posted: 'posted' | 'hidden' (turned off in Settings) | 'failed' | 'noArea'
//   { status: 'closed' }       the race ended before the finish
//   { status: 'implausible' }  too fast to be a run
//   { status: 'signedOut', timeSec }

import { formatRaceTime } from './virtualRaces';

/** "24 minutes 31 seconds", for the voice cue. */
export function speakableRaceTime(timeSec) {
  if (!Number.isFinite(timeSec) || timeSec < 0) return '';
  const total = Math.round(timeSec);
  const parts = [
    [Math.floor(total / 3600), 'hour'],
    [Math.floor((total % 3600) / 60), 'minute'],
    [total % 60, 'second'],
  ];
  const said = parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`);
  return said.length ? said.join(' ') : '0 seconds';
}

/** The sentence under the run screen's race line once the race is over. '' when there is nothing to say. */
export function raceResultMessage(result, race) {
  if (!result || !race) return '';
  if (result.status === 'closed') return 'The race ended before you reached the finish, so this time was not counted.';
  if (result.status === 'implausible') return 'That pace is too fast for a run, so this time was not counted.';
  if (result.status === 'signedOut') return `Finished in ${formatRaceTime(result.timeSec)}. Sign in to put your time on the board.`;
  if (result.status !== 'finished') return '';
  const time = formatRaceTime(result.timeSec);
  if (result.posted === 'hidden') return `Finished in ${time}. Not posted, because you are hidden from leaderboards in Settings.`;
  if (result.posted === 'failed') return `Finished in ${time}. It could not be posted yet. It will be sent the next time you open the race.`;
  if (result.posted === 'noArea') return `Finished in ${time}. It could not be posted because your start point was not known.`;
  if (!result.first && !result.improved) {
    const period = race.cadence === 'weekly' ? 'week' : 'month';
    return `Finished in ${time}. Your best this ${period} is ${formatRaceTime(result.bestSec)}.`;
  }
  const lead = result.improved ? `New best: ${time}` : `Race finished in ${time}`;
  return `${lead}. It is on the ${race.name} board.`;
}
