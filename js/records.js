// Personal records: estimated 1RM (Epley) and best reps at a given weight. Pure logic.
import { EXERCISES } from './exercises.js';
import { fmtKg } from './format.js';

/** Epley estimated one-rep max. A single is its own max. Unreliable above ~12 reps, so those return 0. */
export function epley(weight, reps) {
  if (!(weight > 0) || !(reps > 0) || reps > 12) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Bests across a list of performances: { e1rm, repsAt: Map(weight -> reps), longest }. */
export function bests(history) {
  const out = { e1rm: 0, repsAt: new Map(), longest: 0 };
  for (const perf of history) {
    for (const s of perf.sets) {
      const w = Number(s.weight) || 0, r = Number(s.reps) || 0;
      out.e1rm = Math.max(out.e1rm, epley(w, r));
      out.repsAt.set(w, Math.max(out.repsAt.get(w) || 0, r));
      out.longest = Math.max(out.longest, r);
    }
  }
  return out;
}

/**
 * Records set by today's sets of one exercise, given earlier performances.
 * A first-ever session sets a baseline and reports nothing.
 * Returns [{ exId, name, kind: 'e1rm' | 'reps' | 'time', text }].
 */
export function exercisePRs(exId, sets, history) {
  const e = EXERCISES[exId];
  if (!e || !history.length || !sets.length) return [];
  const prev = bests(history);
  const now = bests([{ sets }]);
  const out = [];
  const pr = (kind, text) => out.push({ exId, name: e.name, kind, text });

  if (e.mode === 'time') {
    if (now.longest > prev.longest) pr('time', `Longest hold: ${now.longest} s (was ${prev.longest} s)`);
    return out;
  }
  if (prev.e1rm > 0 && now.e1rm > prev.e1rm + 0.05) {
    pr('e1rm', `Estimated 1RM: ${fmtKg(now.e1rm)} kg (was ${fmtKg(prev.e1rm)} kg)`);
  }
  // Best reps at a weight: report the heaviest weight where today beat the previous best.
  const beaten = [...now.repsAt.entries()]
    .filter(([w, r]) => prev.repsAt.has(w) && r > prev.repsAt.get(w))
    .sort((a, b) => b[0] - a[0])[0];
  if (beaten) {
    const [w, r] = beaten;
    const where = w > 0 ? ` at ${fmtKg(w)} kg` : (e.equip === 'bw' ? ' at bodyweight' : '');
    pr('reps', `${r} reps${where} (was ${prev.repsAt.get(w)})`);
  }
  return out;
}
