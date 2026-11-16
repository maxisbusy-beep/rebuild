// Double progression, stall detection and set pre-fill. Pure logic.
import { fmtKg } from './format.js';

export const STALL_SESSIONS = 3;

/**
 * Past performances of one exercise, oldest first.
 * Returns [{ date, sets: [{ weight, reps, rir }] }] using only completed sets of finished workouts.
 * Deload-week sessions are skipped (they would look like a stall) unless { all: true }.
 */
export function performances(sessions, exId, { all = false } = {}) {
  return sessions
    .filter((s) => s.type === 'lift' && s.finishedAt && (all || !s.deload))
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const e = (s.exercises || []).find((x) => x.exId === exId);
      const sets = e ? e.sets.filter((x) => x.done !== false) : [];
      return sets.length ? { date: s.date, sets } : null;
    })
    .filter(Boolean);
}

const topWeight = (perf) => Math.max(0, ...perf.sets.map((s) => Number(s.weight) || 0));
const totalReps = (perf) => perf.sets.reduce((n, s) => n + (Number(s.reps) || 0), 0);

/** Every planned set done, at the top of the rep range, with at least 1 rep in reserve. */
export function hitTop(perf, item) {
  return perf.sets.length >= item.sets
    && perf.sets.every((s) => s.reps >= item.repMax && Number.isFinite(s.rir) && s.rir >= 1);
}

/** Same weight for the last 3 sessions, never topping the range, and reps not improving. */
export function isStalled(history, item) {
  if (history.length < STALL_SESSIONS) return false;
  const last = history.slice(-STALL_SESSIONS);
  const w = topWeight(last[0]);
  if (!(w > 0)) return false;
  if (!last.every((p) => topWeight(p) === w && !hitTop(p, item))) return false;
  return totalReps(last[last.length - 1]) <= totalReps(last[0]);
}

const roundTo = (v, step) => Math.round(v / step) * step;

/**
 * What to do next time.
 * ex: exercise definition, item: { sets, repMin, repMax }, history: performances(), oldest first.
 * ramp: true during the first two weeks (weight increases are suppressed).
 * Returns { action: 'first' | 'increase' | 'hold' | 'reduce' | 'reps', weight: number|null, text }.
 */
export function suggest(ex, item, history, { ramp = false } = {}) {
  if (!history.length) {
    return {
      action: 'first', weight: null,
      text: ramp ? 'First time: start light and keep 3+ reps in reserve.' : 'First time: pick a weight that leaves 2–3 reps in reserve.',
    };
  }
  const last = history[history.length - 1];

  if (ex.mode === 'amrap') {
    return { action: 'reps', weight: null, text: `Beat last time: ${totalReps(last)} total reps.` };
  }
  if (ex.mode === 'time') {
    const done = last.sets.length >= item.sets && last.sets.every((s) => s.reps >= item.repMax);
    return {
      action: done ? 'increase' : 'hold', weight: null,
      text: done ? 'All holds completed: add 5–10 s per set.' : `Build to ${item.repMax} s on every set.`,
    };
  }

  const w = topWeight(last);
  const top = item.repMax;

  if (hitTop(last, item)) {
    if (ramp) return { action: 'hold', weight: w || null, text: `All sets hit ${top}. Ramp weeks: hold the weight for now.` };
    if (ex.equip === 'bb' || (w > 0 && ex.inc > 0)) {
      const next = w + (ex.inc || 2.5);
      return { action: 'increase', weight: next, text: `All sets hit ${top}: go up to ${fmtKg(next)} kg.` };
    }
    if (ex.equip === 'db') return { action: 'increase', weight: null, text: `All sets hit ${top}: move up to the next dumbbell size.` };
    if (ex.equip === 'band') return { action: 'increase', weight: null, text: `All sets hit ${top}: use a heavier band or slow the lowering.` };
    return { action: 'increase', weight: null, text: `All sets hit ${top}: add load or a slower tempo.` };
  }

  if (!ramp && isStalled(history, item)) {
    const step = ex.equip === 'bb' ? 2.5 : 1;
    const next = Math.max(step, roundTo(w * 0.9, step));
    return { action: 'reduce', weight: next, text: `Stalled for ${STALL_SESSIONS} sessions: drop to ${fmtKg(next)} kg (about 10% less) and rebuild.` };
  }

  if (w > 0) return { action: 'hold', weight: w, text: `Stay at ${fmtKg(w)} kg and add reps (aim for ${top} on every set).` };
  return { action: 'hold', weight: null, text: `Add reps: aim for ${top} on every set.` };
}

/**
 * Pre-filled sets for a new workout: last session's numbers, adjusted for the suggestion.
 * Returns [{ weight, reps, rir }].
 */
export function prefillSets(ex, item, history, suggestion, { ramp = false } = {}) {
  const last = history.length ? history[history.length - 1] : null;
  const defaultRir = ramp ? 3 : 2;
  const out = [];
  for (let i = 0; i < item.sets; i++) {
    const src = last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null;
    let weight = src ? Number(src.weight) || 0 : 0;
    let reps = src ? src.reps : (ex.mode === 'time' ? item.repMax : item.repMin);
    if (ex.mode === 'reps' && suggestion.weight !== null && suggestion.weight !== undefined) {
      if (suggestion.action === 'increase') { weight = suggestion.weight; reps = item.repMin; }
      else if (suggestion.action === 'reduce') { weight = suggestion.weight; reps = item.repMax; }
    }
    const rir = src && Number.isFinite(src.rir) ? src.rir : defaultRir;
    out.push({ weight, reps, rir: ramp ? Math.max(rir, 3) : rir });
  }
  return out;
}
