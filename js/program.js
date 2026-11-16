// The training program: four workouts in a fixed rotation. Editable in Settings.
import { EXERCISES } from './exercises.js';
import { getKV, setKV } from './db.js';

const item = (exId, sets, repMin, repMax) => ({ exId, sets, repMin, repMax });

export const DEFAULT_PROGRAM = Object.freeze({
  order: ['lowerA', 'upperA', 'lowerB', 'upperB'],
  workouts: {
    lowerA: { name: 'Lower A', items: [
      item('rdl', 3, 8, 10), item('bss', 3, 8, 10), item('goblet', 3, 10, 12), item('plank', 3, 45, 45),
    ] },
    upperA: { name: 'Upper A', items: [
      item('dbbench', 3, 6, 10), item('bbrow', 3, 8, 10), item('chinup', 3, 5, null),
      item('facepull', 3, 15, 15), item('dbcurl', 2, 10, 12),
    ] },
    lowerB: { name: 'Lower B', items: [
      item('deadlift', 3, 5, 5), item('frontsquat', 3, 8, 10), item('hipthrust', 3, 10, 12), item('calf', 3, 15, 15),
    ] },
    upperB: { name: 'Upper B', items: [
      item('dbohp', 3, 8, 10), item('dbrow', 3, 10, 10), item('floorpress', 3, 6, 8), item('pushup', 3, 10, null),
      item('bandlat', 3, 15, 15), item('pushdown', 2, 12, 12),
    ] },
  },
});

export function defaultProgram() {
  return JSON.parse(JSON.stringify(DEFAULT_PROGRAM));
}

const clampInt = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback);

/** Make a stored item safe to use: known exercise, sane sets, repMin <= repMax. */
export function normalizeItem(it) {
  const e = it && EXERCISES[it.exId];
  if (!e) return null;
  const sets = clampInt(it.sets, 1, 8, e.def.sets);
  if (e.mode === 'amrap') return { exId: it.exId, sets, repMin: clampInt(it.repMin, 1, 100, e.def.repMin), repMax: null };
  const cap = e.mode === 'time' ? 600 : 50;
  let lo = clampInt(it.repMin, 1, cap, e.def.repMin);
  let hi = clampInt(it.repMax, 1, cap, e.def.repMax);
  if (e.mode === 'time') lo = hi;
  if (lo > hi) [lo, hi] = [hi, lo];
  return { exId: it.exId, sets, repMin: lo, repMax: hi };
}

/** Repair whatever is stored; fall back to the default for anything unusable. */
export function normalizeProgram(stored) {
  const base = defaultProgram();
  if (!stored || typeof stored !== 'object' || !stored.workouts) return base;
  for (const key of base.order) {
    const w = stored.workouts[key];
    if (!w || !Array.isArray(w.items)) continue;
    const items = w.items.map(normalizeItem).filter(Boolean);
    if (items.length) base.workouts[key].items = items;
  }
  return base;
}

/** Replace the exercise in a slot. Keeps sets; keeps the rep range only when both are plain rep exercises. */
export function swapItem(it, newExId) {
  const from = EXERCISES[it.exId], to = EXERCISES[newExId];
  if (!to) return it;
  const keepRange = from && from.mode === 'reps' && to.mode === 'reps';
  return normalizeItem({
    exId: newExId, sets: it.sets,
    repMin: keepRange ? it.repMin : to.def.repMin,
    repMax: keepRange ? it.repMax : to.def.repMax,
  });
}

/** '3 × 8–10', '3 × 5', '3 × AMRAP', '3 × 45 s', with ' each side' where relevant. */
export function rxLabel(it) {
  const e = EXERCISES[it.exId];
  let what;
  if (e.mode === 'amrap') what = 'AMRAP';
  else if (e.mode === 'time') what = `${it.repMax} s`;
  else what = it.repMin === it.repMax ? `${it.repMax}` : `${it.repMin}–${it.repMax}`;
  return `${it.sets} × ${what}${e.side ? ' each side' : ''}`;
}

export async function loadProgram() {
  return normalizeProgram(await getKV('program'));
}

export const saveProgram = (program) => setKV('program', program);
