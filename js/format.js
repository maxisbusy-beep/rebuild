// Pure display formatting.
import { EXERCISES, hasWeight } from './exercises.js';

/** 60 -> '60', 62.5 -> '62.5', 93.333 -> '93.3' */
export function fmtKg(n) {
  return String(Number((Number(n) || 0).toFixed(1)));
}

/** Seconds -> '2:05' or '1:02:05'. */
export function fmtClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Seconds -> '52 min' or '1 h 05 min'. */
export function fmtDuration(totalSec) {
  const m = Math.max(1, Math.round(totalSec / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** 4820 -> '4,820' */
export function fmtInt(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** One set as text: '60 kg × 10', 'BW × 8', '15 reps', '45 s'. */
export function setLabel(exId, set) {
  const e = EXERCISES[exId];
  if (e.mode === 'time') return `${set.reps} s`;
  if (!hasWeight(e)) return `${set.reps} reps`;
  return set.weight > 0 ? `${fmtKg(set.weight)} kg × ${set.reps}` : `BW × ${set.reps}`;
}

/** A whole performance, compact: '60 kg × 10, 10, 9' or '60×10, 62.5×8' or '45, 45, 40 s'. */
export function setsLabel(exId, sets) {
  const e = EXERCISES[exId];
  if (!sets.length) return '';
  const reps = sets.map((s) => s.reps).join(', ');
  if (e.mode === 'time') return `${reps} s`;
  if (!hasWeight(e)) return `${reps} reps`;
  const weights = [...new Set(sets.map((s) => s.weight))];
  if (weights.length === 1) return weights[0] > 0 ? `${fmtKg(weights[0])} kg × ${reps}` : `BW × ${reps}`;
  return sets.map((s) => `${s.weight > 0 ? fmtKg(s.weight) : 'BW'}×${s.reps}`).join(', ');
}
