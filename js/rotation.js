// Rotation, time-since-last-session, weekly streak and ramp-in window. Pure logic.
import { daysBetween, parseYmd, weekKey, weekStart, addDays } from './dates.js';

export const RAMP_DAYS = 14;
export const STREAK_MIN_LIFTS = 3;

const finishedLifts = (sessions) => sessions.filter((s) => s.type === 'lift' && s.finishedAt);

/** Next workout key: the one after the most recently finished lifting session. Rest and bike days do not advance it. */
export function nextWorkoutKey(order, sessions) {
  const lifts = finishedLifts(sessions).sort((a, b) => a.startedAt - b.startedAt);
  const last = lifts[lifts.length - 1];
  const i = last ? order.indexOf(last.workoutKey) : -1;
  return order[(i + 1) % order.length];
}

/** Whole days since the last lifting or bike session; null if there has never been one. */
export function daysSinceLast(sessions, bike, now = new Date()) {
  const dates = [...finishedLifts(sessions).map((s) => s.date), ...bike.map((b) => b.date)].filter(Boolean).sort();
  if (!dates.length) return null;
  return Math.max(0, daysBetween(parseYmd(dates[dates.length - 1]), now));
}

/** 'ok' under 3 days, 'amber' from 3, 'red' from 5. */
export function gapLevel(days) {
  if (days === null || days < 3) return 'ok';
  return days >= 5 ? 'red' : 'amber';
}

/**
 * Consecutive weeks (Mon-Sun) with at least 3 lifting sessions.
 * The current week counts once it reaches 3; until then it neither adds to nor breaks the streak.
 */
export function weekStreak(sessions, now = new Date()) {
  const perWeek = new Map();
  for (const s of finishedLifts(sessions)) {
    const k = weekKey(parseYmd(s.date));
    perWeek.set(k, (perWeek.get(k) || 0) + 1);
  }
  let streak = 0;
  let cursor = weekStart(now);
  if ((perWeek.get(weekKey(cursor)) || 0) >= STREAK_MIN_LIFTS) streak++;
  for (;;) {
    cursor = addDays(cursor, -7);
    if ((perWeek.get(weekKey(cursor)) || 0) >= STREAK_MIN_LIFTS) streak++;
    else break;
  }
  return streak;
}

/** True during the first two weeks after the first lifting session (and before any session). */
export function rampActive(sessions, now = new Date()) {
  const dates = finishedLifts(sessions).map((s) => s.date).sort();
  if (!dates.length) return true;
  return daysBetween(parseYmd(dates[0]), now) < RAMP_DAYS;
}
