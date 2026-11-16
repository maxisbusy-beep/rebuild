// Numbers behind the Progress tab. Pure logic.
import { EXERCISES, MUSCLES, hasWeight } from './exercises.js';
import { performances } from './progression.js';
import { bests } from './records.js';
import { parseYmd, weekStart, weekKey, addDays, ymd } from './dates.js';
import { inWeek } from './week.js';
import { fmtKg } from './format.js';

const finishedLifts = (sessions) => sessions.filter((s) => s.type === 'lift' && s.finishedAt);

/** One point per session for an exercise: top set weight, best estimated 1RM, best reps (or seconds). */
export function exerciseSeries(sessions, exId) {
  return performances(sessions, exId, { all: true }).map((p) => ({
    t: parseYmd(p.date).getTime(),
    top: Math.max(0, ...p.sets.map((s) => Number(s.weight) || 0)),
    e1rm: bests([p]).e1rm,
    best: Math.max(0, ...p.sets.map((s) => Number(s.reps) || 0)),
  }));
}

/** Exercises that have been logged, most-trained first. */
export function loggedExercises(sessions) {
  const counts = new Map();
  for (const s of finishedLifts(sessions)) {
    for (const e of s.exercises || []) if (EXERCISES[e.exId]) counts.set(e.exId, (counts.get(e.exId) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || EXERCISES[a[0]].name.localeCompare(EXERCISES[b[0]].name)).map(([id]) => id);
}

function muscleSets(sessions, now) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
  for (const s of finishedLifts(sessions)) {
    if (!inWeek(s.date, now)) continue;
    for (const e of s.exercises || []) {
      const ex = EXERCISES[e.exId];
      if (!ex) continue;
      const n = e.sets.filter((x) => x.done !== false).length;
      ex.muscles.forEach((m, i) => { out[m] += i === 0 ? n : n * 0.5; });
    }
  }
  return out;
}

/**
 * Weekly volume per muscle group, counted in sets: the main muscle of an exercise gets a full set,
 * supporting muscles half a set. Returns [{ muscle, sets, prev }] with last week's figure for comparison.
 */
export function muscleVolume(sessions, now = new Date()) {
  const cur = muscleSets(sessions, now);
  const prev = muscleSets(sessions, addDays(weekStart(now), -1));
  return MUSCLES.map((m) => ({ muscle: m, sets: cur[m], prev: prev[m] }));
}

/** Lifting and bike sessions for each of the last n weeks, oldest first: [{ week, t, lifts, rides }]. */
export function sessionsPerWeek(sessions, bike, now = new Date(), n = 8) {
  const lifts = new Map(), rides = new Map();
  const bump = (map, date) => { const k = weekKey(parseYmd(date)); map.set(k, (map.get(k) || 0) + 1); };
  for (const s of finishedLifts(sessions)) bump(lifts, s.date);
  for (const b of bike) bump(rides, b.date);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(weekStart(now), -7 * i);
    const k = ymd(start);
    out.push({ week: k, t: start.getTime(), lifts: lifts.get(k) || 0, rides: rides.get(k) || 0 });
  }
  return out;
}

/** Best marks per exercise: [{ exId, name, main, sub }]. */
export function recordsList(sessions) {
  return loggedExercises(sessions).map((id) => {
    const ex = EXERCISES[id];
    const b = bests(performances(sessions, id, { all: true }));
    if (ex.mode === 'time') return { exId: id, name: ex.name, main: `${b.longest} s`, sub: 'Longest hold' };
    const heaviest = Math.max(0, ...b.repsAt.keys());
    if (!hasWeight(ex) || heaviest === 0) return { exId: id, name: ex.name, main: `${b.longest} reps`, sub: 'Most reps in a set' };
    return {
      exId: id, name: ex.name,
      main: `${fmtKg(heaviest)} kg × ${b.repsAt.get(heaviest)}`,
      sub: b.e1rm > 0 ? `Estimated 1RM ${fmtKg(b.e1rm)} kg` : 'Heaviest set',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Calendar of the last n weeks, oldest week first. Each week is 7 days Mon-Sun:
 * { date, lift, bike, rest, future }.
 */
export function heatmap(sessions, bike, now = new Date(), n = 12) {
  const liftDays = new Set(finishedLifts(sessions).map((s) => s.date));
  const restDays = new Set(sessions.filter((s) => s.type === 'rest').map((s) => s.date));
  const bikeDays = new Set(bike.map((b) => b.date));
  const today = ymd(now);
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(weekStart(now), -7 * i);
    weeks.push(Array.from({ length: 7 }, (_, d) => {
      const date = ymd(addDays(start, d));
      return { date, lift: liftDays.has(date), bike: bikeDays.has(date), rest: restDays.has(date), future: date > today };
    }));
  }
  return weeks;
}

/**
 * Which exercises trigger the right-shoulder flag.
 * Returns [{ exId, name, logged, pop, pain, last }] for exercises with at least one pop or pain, worst first.
 * `logged` counts sessions where the exercise was done.
 */
export function shoulderReport(sessions) {
  const rows = new Map();
  for (const s of finishedLifts(sessions)) {
    for (const e of s.exercises || []) {
      const ex = EXERCISES[e.exId];
      if (!ex || !ex.upper) continue;
      if (!rows.has(e.exId)) rows.set(e.exId, { exId: e.exId, name: ex.name, logged: 0, pop: 0, pain: 0, last: null });
      const r = rows.get(e.exId);
      r.logged++;
      if (e.flag === 'pop' || e.flag === 'pain') {
        r[e.flag]++;
        if (!r.last || s.date > r.last) r.last = s.date;
      }
    }
  }
  return [...rows.values()]
    .filter((r) => r.pop + r.pain > 0)
    .sort((a, b) => b.pain - a.pain || b.pop - a.pop || a.name.localeCompare(b.name));
}
