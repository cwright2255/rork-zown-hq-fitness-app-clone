import { speakableRaceTime, raceResultMessage } from '../lib/raceMessages';

const local = { name: 'Local 5K', cadence: 'weekly' };
const world = { name: 'Worldwide 10K', cadence: 'monthly' };
const finished = (extra = {}) => ({
  status: 'finished', timeSec: 1471, bestSec: 1471, first: true, improved: false, posted: 'posted', ...extra,
});

describe('speakableRaceTime', () => {
  it('says hours, minutes and seconds, leaving out what is zero', () => {
    expect(speakableRaceTime(1471)).toBe('24 minutes 31 seconds');
    expect(speakableRaceTime(3725)).toBe('1 hour 2 minutes 5 seconds');
    expect(speakableRaceTime(3600)).toBe('1 hour');
    expect(speakableRaceTime(7200 + 60)).toBe('2 hours 1 minute');
    expect(speakableRaceTime(61)).toBe('1 minute 1 second');
    expect(speakableRaceTime(60)).toBe('1 minute');
    expect(speakableRaceTime(1)).toBe('1 second');
    expect(speakableRaceTime(45)).toBe('45 seconds');
    expect(speakableRaceTime(0)).toBe('0 seconds');
  });
  it('rounds to whole seconds', () => {
    expect(speakableRaceTime(1470.6)).toBe('24 minutes 31 seconds');
  });
  it('says nothing for anything that is not a time', () => {
    for (const bad of [NaN, -1, undefined, null, '1500', Infinity]) expect(speakableRaceTime(bad)).toBe('');
  });
});

describe('raceResultMessage', () => {
  it('tells a first finish it is on the board', () => {
    expect(raceResultMessage(finished(), local)).toBe('Race finished in 24:31. It is on the Local 5K board.');
    expect(raceResultMessage(finished({ timeSec: 3100, bestSec: 3100 }), world)).toBe('Race finished in 51:40. It is on the Worldwide 10K board.');
  });
  it('calls a faster run a new best', () => {
    expect(raceResultMessage(finished({ first: false, improved: true }), local)).toBe('New best: 24:31. It is on the Local 5K board.');
  });
  it('tells a slower run what the best is, this week or this month', () => {
    const slower = finished({ first: false, improved: false, timeSec: 1550, bestSec: 1471 });
    expect(raceResultMessage(slower, local)).toBe('Finished in 25:50. Your best this week is 24:31.');
    expect(raceResultMessage(slower, world)).toBe('Finished in 25:50. Your best this month is 24:31.');
  });
  it('says when it was not posted, and why', () => {
    expect(raceResultMessage(finished({ posted: 'hidden' }), local)).toBe('Finished in 24:31. Not posted, because you are hidden from leaderboards in Settings.');
    expect(raceResultMessage(finished({ posted: 'failed' }), local)).toBe('Finished in 24:31. It could not be posted yet. It will be sent the next time you open the race.');
    expect(raceResultMessage(finished({ posted: 'noArea' }), local)).toBe('Finished in 24:31. It could not be posted because your start point was not known.');
  });
  it('says so when the time does not count', () => {
    expect(raceResultMessage({ status: 'closed' }, local)).toBe('The race ended before you reached the finish, so this time was not counted.');
    expect(raceResultMessage({ status: 'implausible' }, local)).toBe('That pace is too fast for a run, so this time was not counted.');
    expect(raceResultMessage({ status: 'signedOut', timeSec: 1471 }, local)).toBe('Finished in 24:31. Sign in to put your time on the board.');
  });
  it('says nothing when there is nothing to say', () => {
    expect(raceResultMessage({ status: 'unfinished' }, local)).toBe('');
    expect(raceResultMessage({ status: 'other' }, local)).toBe('');
    expect(raceResultMessage(null, local)).toBe('');
    expect(raceResultMessage(undefined, local)).toBe('');
    expect(raceResultMessage(finished(), null)).toBe('');
    expect(raceResultMessage(finished(), undefined)).toBe('');
  });
});
