// Daily check-ins: protein tally, creatine, mobility, sleep. Pure logic.
import { parseYmd, ymd, addDays } from './dates.js';

export const PROTEIN_QUICK = [20, 30, 40];
export const MOBILITY_MOVES = ['Band dislocates', 'Deep squat hold', 'Hip flexor stretch'];

export function emptyDay(date) {
  return { id: date, date, protein: [], creatine: false, mobility: false, sleep: null };
}

/** A stored day with any missing fields filled in. */
export function withDay(rec, date) {
  const base = emptyDay(date);
  if (!rec || typeof rec !== 'object') return base;
  return { ...base, ...rec, id: date, date, protein: Array.isArray(rec.protein) ? rec.protein : [] };
}

export function proteinTotal(day) {
  return Math.round((day.protein || []).reduce((sum, e) => sum + (Number(e.g) || 0), 0));
}

/** Add a protein entry (ignored unless grams is a positive number). Returns a new day. */
export function addProtein(day, grams, label = '', now = Date.now()) {
  const g = Math.round(Number(grams));
  if (!(g > 0) || g > 500) return day;
  return { ...day, protein: [...day.protein, { g, label: String(label || '').slice(0, 40), at: now }] };
}

/** Remove the most recent protein entry. Returns a new day. */
export function undoProtein(day) {
  return { ...day, protein: day.protein.slice(0, -1) };
}

/**
 * Consecutive days a habit was ticked, ending today.
 * If today is not ticked yet the streak through yesterday still stands.
 */
export function habitStreak(days, field, today = ymd()) {
  const done = new Set(days.filter((d) => d && d[field]).map((d) => d.date));
  let cursor = parseYmd(today);
  if (!done.has(today)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (done.has(ymd(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Tidy a saved quick-add food; null if unusable. */
export function cleanFood(name, grams) {
  const n = String(name || '').trim().slice(0, 30);
  const g = Math.round(Number(grams));
  return n && g > 0 && g <= 500 ? { name: n, g } : null;
}
