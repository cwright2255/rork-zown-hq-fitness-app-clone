// lib/rankChallengeData.js
//
// What the Challenges & Rank card on Home says, as plain functions: no React, no Firebase, no stores, so each rule is unit tested.
// The card (components/RankChallengeWidget.jsx) only draws what these return.
//
// Two halves:
//   Friends rank   where the person stands among the people they follow, by XP: the Leaderboard screen's Following filter on its XP
//                  board, ranked with the same function (lib/audience.js rankEntries), so the place on Home is the place there.
//   Challenge      the live challenge they have joined (the daily, weekly, monthly or seasonal one that is on now) and how far
//                  along they are, or a nudge to join one.
import { rankEntries } from './audience';
import { boardValue } from './runLeaderboard';

const DAY_MS = 24 * 60 * 60 * 1000;
const DASH = '\u2014';

/** "1st", "2nd", "3rd", "4th", "11th", "21st", "112th". */
export function ordinal(n) {
  const v = Math.floor(Number(n));
  const lastTwo = v % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${v}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th';
  return `${v}${suffix}`;
}

const FRIENDS_CAPTION = {
  loading: 'Loading',
  failed: "Couldn't load",
  hidden: 'Hidden from leaderboards',
  noFollowing: 'Follow friends to compare',
  unranked: 'Not ranked yet',
  alone: 'No friends ranked yet',
};

/**
 * Where the person stands among the people they follow, ready to draw:
 * { state, rank, total, value, caption, sentence, route }.
 *   myUid          the signed-in person
 *   hidden         "Show in Leaderboards" is off: their entry is taken off the boards, so there is no place to show
 *   status         'loading', 'ready' or 'failed': how the lookup of the entries went
 *   followingCount how many people they follow
 *   entries        the leaderboard entries of the people they follow and themself, in any order ({ id, name, xp })
 * `state` is one of ranked, hidden, failed, loading, noFollowing, unranked (they have no entry) or alone (nobody they follow has one).
 * `route` is where a tap goes: the Friends screen when they follow nobody, otherwise the Leaderboard.
 */
export function friendsRankSummary({ myUid, hidden, status, followingCount, entries } = {}) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e === 'object');
  const ranked = rankEntries(list, (e) => boardValue(e, 'xp'));
  const me = myUid ? ranked.find((e) => e.id === myUid) : undefined;

  let state;
  if (hidden) state = 'hidden';
  else if (status === 'failed') state = 'failed';
  else if (status !== 'ready') state = 'loading';
  else if (!(followingCount >= 1)) state = 'noFollowing';
  else if (!me) state = 'unranked';
  else if (ranked.length < 2) state = 'alone';
  else state = 'ranked';

  const route = state === 'noFollowing' ? '/friends' : '/leaderboard';
  if (state !== 'ranked') {
    const caption = FRIENDS_CAPTION[state];
    return { state, rank: null, total: null, value: DASH, caption, sentence: `Friends rank: ${caption.toLowerCase()}`, route };
  }
  const total = ranked.length;
  return {
    state,
    rank: me.rank,
    total,
    value: `#${me.rank}`,
    caption: `of ${total} by XP`,
    sentence: `Friends rank: ${ordinal(me.rank)} of ${total} by XP`,
    route,
  };
}

const CADENCES = ['daily', 'weekly', 'monthly', 'seasonal'];
const CADENCE_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', seasonal: 'Seasonal' };
// With nothing joined, the one to suggest: this week's first, as it is the one with time to do it.
const SUGGEST_ORDER = ['weekly', 'daily', 'monthly', 'seasonal'];

/** "4 days left", "1 day left", "ends today", or '' when the challenge has no usable end. Same rule as the Challenges screen. */
export function daysLeftLabel(endDate, now = new Date()) {
  if (!endDate) return '';
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return '';
  const days = Math.ceil((end - now.getTime()) / DAY_MS);
  if (days <= 0) return 'ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function endMs(challenge) {
  const t = challenge.endDate ? new Date(challenge.endDate).getTime() : NaN;
  return Number.isFinite(t) ? t : Infinity;
}

/**
 * The live challenge to show, ready to draw: { state, cadence, challengeId, label, title, value, pct, completed, caption, sentence }.
 *   challenges  the loaded challenges ({ id, cadence, periodKey, title, endDate, ... })
 *   periodKeyOf (cadence, now) gives the period key the challenge on now has (challengeStore's getCurrentPeriodKey)
 *   joinedIds   the ids the person has joined (a Set or an array)
 *   progressOf  (challenge) gives { current, target, percent, completed } (challengeStore's getProgress)
 * The challenge is the one on now for each cadence (an old daily or last season's does not count). Of the ones the person has joined it
 * picks one not yet finished, the one ending soonest, or when all are finished the one ending soonest. `state` is joined, join (none
 * joined: the one to suggest) or none. `pct` is the bar's fill, or null when there is no bar.
 */
export function liveChallengeSummary({ challenges, periodKeyOf, joinedIds, progressOf, now = new Date() } = {}) {
  const list = (Array.isArray(challenges) ? challenges : []).filter((c) => c && typeof c === 'object');
  const isJoined = (id) => (joinedIds instanceof Set ? joinedIds.has(id) : Array.isArray(joinedIds) && joinedIds.includes(id));
  const current = CADENCES
    .map((cadence) => ({ cadence, challenge: list.find((c) => c.cadence === cadence && c.periodKey === periodKeyOf(cadence, now)) || null }))
    .filter((e) => e.challenge);

  const joined = current
    .filter((e) => isJoined(e.challenge.id))
    .map((e) => ({ ...e, progress: progressOf(e.challenge) }))
    .filter((e) => e.progress);

  if (joined.length > 0) {
    const open = joined.filter((e) => !e.progress.completed);
    const pool = open.length > 0 ? open : joined;
    const pick = pool.reduce((best, e) => (endMs(e.challenge) < endMs(best.challenge) ? e : best));
    const { cadence, challenge, progress } = pick;
    const label = `${CADENCE_LABEL[cadence]} challenge`;
    const title = challenge.title || label;
    const percent = Number.isFinite(Number(progress.percent)) ? Math.min(100, Math.max(0, Number(progress.percent))) : 0;
    const completed = !!progress.completed;
    const caption = completed ? 'Complete' : daysLeftLabel(challenge.endDate, now);
    return {
      state: 'joined',
      cadence,
      challengeId: challenge.id,
      label,
      title,
      value: `${progress.current}/${progress.target}`,
      pct: percent,
      completed,
      caption,
      sentence: `${label}: ${title}, ${progress.current} of ${progress.target}${caption ? `, ${caption.toLowerCase()}` : ''}`,
    };
  }

  const suggestion = SUGGEST_ORDER.map((cadence) => current.find((e) => e.cadence === cadence)).find(Boolean);
  if (suggestion) {
    const { cadence, challenge } = suggestion;
    const label = `${CADENCE_LABEL[cadence]} challenge`;
    const title = challenge.title || label;
    return {
      state: 'join',
      cadence,
      challengeId: challenge.id,
      label,
      title,
      value: 'Join',
      pct: null,
      completed: false,
      caption: 'Tap to join',
      sentence: `${label}: ${title}, not joined yet`,
    };
  }

  return {
    state: 'none',
    cadence: null,
    challengeId: null,
    label: 'Challenges',
    title: '',
    value: DASH,
    pct: null,
    completed: false,
    caption: 'Open Challenges',
    sentence: 'Challenges: none live right now',
  };
}
