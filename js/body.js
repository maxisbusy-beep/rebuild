// Body check-ins: weekly prompt, moving average, rate of change and eating guidance. Pure logic.
import { parseYmd, weekKey, DAY_MS } from './dates.js';
import { performances } from './progression.js';
import { bests } from './records.js';
import { EXERCISES } from './exercises.js';
import { fmtKg } from './format.js';

export const AIM_TEXT = 'Aim to lose about 0.25–0.5 kg per week while your lifts go up.';
export const FAST_RATE = -0.5; // kg per week
export const SLOW_RATE = -0.25;

export const sortEntries = (entries) => [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/** True if there is no check-in yet in the current Mon-Sun week. */
export function checkinDue(entries, now = new Date()) {
  const wk = weekKey(now);
  return !entries.some((e) => weekKey(parseYmd(e.date)) === wk);
}

/** Points [{ t, y }] for one field, oldest first, skipping empty values. */
export function pointsOf(entries, field) {
  return sortEntries(entries)
    .filter((e) => Number.isFinite(e[field]) && e[field] > 0)
    .map((e) => ({ t: parseYmd(e.date).getTime(), y: e[field] }));
}

/** Trailing moving average: each point becomes the mean of all points in the `windowDays` ending on it. */
export function movingAverage(points, windowDays = 28) {
  const span = windowDays * DAY_MS;
  return points.map((p, i) => {
    let sum = 0, n = 0;
    for (let j = i; j >= 0 && p.t - points[j].t < span; j--) { sum += points[j].y; n++; }
    return { t: p.t, y: sum / n };
  });
}

/** Mean weight per Mon-Sun week, oldest first: [{ week, t, mean }]. */
export function weeklyMeans(entries, field = 'weight') {
  const groups = new Map();
  for (const e of entries) {
    if (!Number.isFinite(e[field]) || !(e[field] > 0)) continue;
    const wk = weekKey(parseYmd(e.date));
    if (!groups.has(wk)) groups.set(wk, []);
    groups.get(wk).push(e[field]);
  }
  return [...groups.entries()]
    .map(([week, vals]) => ({ week, t: parseYmd(week).getTime(), mean: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => a.t - b.t);
}

/** Change per week between consecutive check-in weeks (kg/week; negative = losing), oldest first. */
export function weeklyChanges(entries, field = 'weight') {
  const means = weeklyMeans(entries, field);
  const out = [];
  for (let i = 1; i < means.length; i++) {
    const weeks = Math.max(1, Math.round((means[i].t - means[i - 1].t) / (7 * DAY_MS)));
    out.push((means[i].mean - means[i - 1].mean) / weeks);
  }
  return out;
}

/** Exercises whose best estimated 1RM fell by more than 2.5% between the last two sessions (recent ones only). */
export function droppedLifts(sessions, now = new Date()) {
  const cutoff = now.getTime() - 21 * DAY_MS;
  const ids = new Set(sessions.flatMap((s) => (s.exercises || []).map((e) => e.exId)));
  const out = [];
  for (const id of ids) {
    const h = performances(sessions, id);
    if (h.length < 2 || !EXERCISES[id]) continue;
    const last = h[h.length - 1], prev = h[h.length - 2];
    if (parseYmd(last.date).getTime() < cutoff) continue;
    const a = bests([prev]).e1rm, b = bests([last]).e1rm;
    if (a > 0 && b > 0 && b < a * 0.975) out.push(EXERCISES[id].name);
  }
  return out;
}

/**
 * Eating guidance from the weight trend and lift trend.
 * Returns { status: 'start' | 'tooFast' | 'liftsDrop' | 'fastWeek' | 'onTrack' | 'holding', tone, text }.
 */
export function guidance(entries, sessions = [], now = new Date()) {
  const changes = weeklyChanges(entries);
  const dropped = droppedLifts(sessions, now);
  if (!changes.length) {
    return { status: 'start', tone: '', text: 'Check in once a week, same day and time, ideally first thing in the morning. The trend appears after two weeks.' };
  }
  const last = changes[changes.length - 1];
  const prev = changes.length > 1 ? changes[changes.length - 2] : null;
  const rate = `${fmtKg(Math.abs(last))} kg per week`;

  if (last < FAST_RATE && prev !== null && prev < FAST_RATE) {
    return { status: 'tooFast', tone: 'amber', text: 'Weight has fallen faster than 0.5 kg per week for two weeks running. Eat a little more to protect muscle and strength.' };
  }
  if (dropped.length >= 2) {
    return { status: 'liftsDrop', tone: 'amber', text: `Your lifts have dipped (${dropped.slice(0, 3).join(', ')}). If that continues, eat a little more.` };
  }
  if (last < FAST_RATE) {
    return { status: 'fastWeek', tone: '', text: `Down ${rate}: a little fast. If it repeats next week, eat a little more.` };
  }
  if (last <= SLOW_RATE) {
    return { status: 'onTrack', tone: 'good', text: `On track: down ${rate}.` };
  }
  return {
    status: 'holding', tone: '',
    text: last > 0.05 ? `Up ${rate}. Fine if lifts are climbing; to lose fat, trim intake slightly.` : 'Weight is holding steady. Fine if lifts are climbing; to lose fat, trim intake slightly.',
  };
}
