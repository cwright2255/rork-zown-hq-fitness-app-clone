// lib/runLeaderboard.js
//
// The distance boards on the leaderboard: how far each person ran or walked
// this week and this month. Pure functions, no React, no Firebase.
//
// How it is stored: each person's public `leaderboard/{uid}` document gets a
// `distance` map holding only the CURRENT week and month, keyed by the period,
// for example { w20261005: 12.4, m202610: 31.8 } (kilometres). The map is
// replaced as a whole every time it is published, so when a new week starts
// the old key is simply gone. The board orders by `distance.w20261005`, and
// a document without that field is left out by Firestore. That means a person
// who has not run this week drops off the weekly board by itself, with no
// composite index and nothing to clean up.
//
// What counts: runs and walks recorded in Zown. Not imported ones (they are
// from outside Zown, and imports earn no XP either), and not a "run" faster
// than MIN_BOARD_PACE seconds per km, which is a bike or a car, not a person.

import { runPaceSecPerKm, runTime } from './runStats';

/** The ways the leaderboard can be ranked. `xp` is the original one. */
export const BOARDS = [
  { id: 'xp', label: 'XP', metric: 'xp' },
  { id: 'week', label: 'This week', metric: 'distance' },
  { id: 'month', label: 'This month', metric: 'distance' },
];
export const DEFAULT_BOARD = 'xp';
/** Faster than this (seconds per km) is not on foot. 2:30 /km is quicker than the 5K world record. */
export const MIN_BOARD_PACE = 150;

const pad = (n) => String(n).padStart(2, '0');

export const isDistanceBoard = (board) => board === 'week' || board === 'month';

/** The board to use for a value that might be junk. */
export function cleanBoard(board) {
  return BOARDS.some((b) => b.id === board) ? board : DEFAULT_BOARD;
}

/** Monday 00:00 (local time) of the week a moment falls in. */
export function weekStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** { week: 'w20261005', month: 'm202610' }: the keys for the week and month a moment falls in (local time). */
export function periodKeys(ms = Date.now()) {
  const ws = weekStart(ms);
  const d = new Date(ms);
  return {
    week: `w${ws.getFullYear()}${pad(ws.getMonth() + 1)}${pad(ws.getDate())}`,
    month: `m${d.getFullYear()}${pad(d.getMonth() + 1)}`,
  };
}

/** True when a saved run should count on the distance boards. */
export function countsForBoard(run) {
  if (!run || typeof run !== 'object') return false;
  if (run.source) return false; // imported from another app
  const km = Number(run.distance);
  if (!(km > 0) || !Number.isFinite(km)) return false;
  if (!(runTime(run) > 0)) return false;
  return runPaceSecPerKm(run) >= MIN_BOARD_PACE;
}

/**
 * The `distance` map to publish: kilometres (two decimals) for the current
 * week and the current month, from the runs that count. A period with nothing
 * in it is left out, so an empty history gives {}.
 */
export function distanceTotals(runs, now = Date.now()) {
  const keys = periodKeys(now);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekFrom = weekStart(now).getTime();
  const monthFrom = monthStart.getTime();

  let week = 0;
  let month = 0;
  (Array.isArray(runs) ? runs : []).forEach((run) => {
    if (!countsForBoard(run)) return;
    // The day it was run (its start, so a run that crosses midnight counts where it began).
    const t = Date.parse(run.startTime || run.endTime || '');
    const when = Number.isFinite(t) ? t : runTime(run);
    if (when >= weekFrom && when <= now) week += Number(run.distance);
    if (when >= monthFrom && when <= now) month += Number(run.distance);
  });

  const out = {};
  const r2 = (v) => Math.round(v * 100) / 100;
  if (week > 0) out[keys.week] = r2(week);
  if (month > 0) out[keys.month] = r2(month);
  return out;
}

/** The Firestore field a board orders by: 'xp', or 'distance.w20261005' / 'distance.m202610'. */
export function boardField(board, now = Date.now()) {
  if (!isDistanceBoard(board)) return 'xp';
  return `distance.${periodKeys(now)[board]}`;
}

/** One person's number on a board (0 when they have none). */
export function boardValue(entry, board, now = Date.now()) {
  if (!entry) return 0;
  if (!isDistanceBoard(board)) return Number(entry.xp) || 0;
  const km = entry.distance && typeof entry.distance === 'object'
    ? Number(entry.distance[periodKeys(now)[board]])
    : 0;
  return Number.isFinite(km) && km > 0 ? km : 0;
}

/** "12.4 km" / "128 km" / "1,250 XP". */
export function formatBoardValue(board, value) {
  const v = Number(value) || 0;
  if (!isDistanceBoard(board)) return `${Math.round(v).toLocaleString()} XP`;
  const tenth = Math.round(v * 10) / 10;
  return `${tenth >= 100 ? Math.round(v) : tenth.toFixed(1)} km`;
}

/** What to say when a board has nobody on it. */
export function emptyBoardMessage(board, audience = 'everyone') {
  const period = board === 'month' ? 'this month' : 'this week';
  if (audience === 'close') return `None of your close friends have logged a run or walk ${period} yet.`;
  if (audience === 'following') return `Nobody you follow has logged a run or walk ${period} yet.`;
  return `Nobody has logged a run or walk ${period} yet. Record one to get on the board.`;
}
