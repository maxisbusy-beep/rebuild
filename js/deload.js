// Deload weeks: suggested every 6th training week, or started on request. ~60% of normal volume.
import { weekKey, weekStart, parseYmd, daysBetween, addDays } from './dates.js';
import { getKV, setKV } from './db.js';

export const DELOAD_EVERY = 6;
export const DELOAD_FACTOR = 0.6;
export const DELOAD_TEXT = 'Deload week: about 60% of normal volume. Fewer sets, same weights, stop well short of failure.';

/** Sets to do in a deload week: about 60% of planned, at least 1 (3 becomes 2, 2 becomes 1, 4 becomes 2). */
export const deloadSets = (planned) => Math.max(1, Math.round(planned * DELOAD_FACTOR));

/** Stored state with defaults: { weeks: [weekKey of each deload week], skipped: weekKey | null }. */
export function normalizeDeload(stored) {
  const weeks = stored && Array.isArray(stored.weeks) ? stored.weeks.filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)) : [];
  return { weeks: [...new Set(weeks)].sort(), skipped: stored && typeof stored.skipped === 'string' ? stored.skipped : null };
}

/**
 * Where we are in the deload cycle.
 * Weeks are counted from the first lifting session, or from the week after the most recent deload.
 * Returns { active, due, weekNumber } where weekNumber 6 means "this is the 6th week: deload".
 */
export function deloadStatus(sessions, state, now = new Date()) {
  const st = normalizeDeload(state);
  const current = weekKey(now);
  const active = st.weeks.includes(current);

  const past = st.weeks.filter((w) => w <= current);
  let anchor = null;
  if (past.length) {
    anchor = addDays(parseYmd(past[past.length - 1]), 7);
  } else {
    const dates = sessions.filter((s) => s.type === 'lift' && s.finishedAt).map((s) => s.date).sort();
    if (dates.length) anchor = weekStart(parseYmd(dates[0]));
  }
  if (!anchor) return { active, due: false, weekNumber: 0 };

  const weeksIn = Math.round(daysBetween(anchor, weekStart(now)) / 7);
  const weekNumber = weeksIn < 0 ? 0 : weeksIn + 1;
  const due = !active && weekNumber >= DELOAD_EVERY && st.skipped !== current;
  return { active, due, weekNumber };
}

/** Mark the current week as a deload week. */
export function startDeload(state, now = new Date()) {
  const st = normalizeDeload(state);
  return normalizeDeload({ ...st, weeks: [...st.weeks, weekKey(now)] });
}

/** Cancel the current week's deload. */
export function endDeload(state, now = new Date()) {
  const st = normalizeDeload(state);
  return { ...st, weeks: st.weeks.filter((w) => w !== weekKey(now)) };
}

/** Dismiss this week's suggestion; it comes back next week. */
export function skipDeload(state, now = new Date()) {
  return { ...normalizeDeload(state), skipped: weekKey(now) };
}

export async function loadDeload() {
  return normalizeDeload(await getKV('deload'));
}
export const saveDeload = (state) => setKV('deload', normalizeDeload(state));
