// User settings with defaults. Stored as one record in the 'kv' store.
import { getKV, setKV } from './db.js';

export const DEFAULTS = Object.freeze({
  age: 51,
  heightCm: 186,
  maxHr: null,          // null = estimate as 220 - age
  proteinTarget: 190,   // g per day
  restCompound: 150,    // seconds
  restAccessory: 75,    // seconds
});

/** Fill in defaults for anything missing (pure, tested). */
export function withDefaults(stored) {
  return { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

/** Max heart rate: the user's override, else 220 - age. */
export function maxHr(settings) {
  return settings.maxHr || 220 - settings.age;
}

/** Easy-cardio zone, 60-70% of max. */
export function easyZone(settings) {
  const m = maxHr(settings);
  return { low: Math.round(m * 0.6), high: Math.round(m * 0.7) };
}

export async function loadSettings() {
  return withDefaults(await getKV('settings'));
}

export async function saveSettings(patch) {
  const next = { ...(await loadSettings()), ...patch };
  await setKV('settings', next);
  return next;
}
