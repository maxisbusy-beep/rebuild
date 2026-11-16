// Bike sessions: validation, speed, trend series and the stopwatch. Pure logic.
import { parseYmd, ymd } from './dates.js';

/** Average speed in km/h, or null if distance or duration is missing. */
export function avgSpeed(ride) {
  return ride && ride.distance > 0 && ride.duration > 0 ? ride.distance / (ride.duration / 60) : null;
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const OPTIONAL = [
  ['distance', 'Distance', 0, 300],
  ['resistance', 'Resistance', 0, 100],
  ['avgHr', 'Heart rate', 30, 230],
  ['calories', 'Calories', 0, 5000],
];

/**
 * Check and tidy a ride entered by the user. Only duration is required.
 * Returns { ok, errors, ride } where empty optional fields become null.
 */
export function cleanRide(draft, today = ymd()) {
  const errors = [];
  const ride = { ...draft };

  const duration = num(draft.duration);
  if (duration === null || Number.isNaN(duration) || duration <= 0) errors.push('Enter the duration in minutes.');
  else if (duration > 600) errors.push('Duration looks too long (over 600 minutes).');
  ride.duration = duration;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || '')) || ymd(parseYmd(draft.date)) !== draft.date) errors.push('Choose a valid date.');
  else if (draft.date > today) errors.push('The date cannot be in the future.');

  for (const [key, label, lo, hi] of OPTIONAL) {
    const v = num(draft[key]);
    if (Number.isNaN(v) || (v !== null && (v < lo || v > hi))) errors.push(`${label} should be between ${lo} and ${hi}.`);
    ride[key] = v;
  }
  const feel = num(draft.feel);
  ride.feel = feel !== null && feel >= 1 && feel <= 5 ? Math.round(feel) : null;
  ride.note = String(draft.note || '').trim().slice(0, 500);
  return { ok: errors.length === 0, errors, ride };
}

/** Time series of one value across rides, oldest first: [{ t, y }]. `pick` returns a number or null. */
export function series(rides, pick) {
  return rides
    .map((r) => ({ t: parseYmd(r.date).getTime(), y: pick(r) }))
    .filter((p) => p.y !== null && p.y !== undefined && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t);
}

/** Resistance levels that have heart-rate data, most used first. */
export function resistanceLevels(rides) {
  const counts = new Map();
  for (const r of rides) {
    if (r.resistance === null || r.resistance === undefined || !(r.avgHr > 0)) continue;
    counts.set(r.resistance, (counts.get(r.resistance) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([level]) => level);
}

/** Average heart rate over time at one resistance level (lower at the same level = fitter). */
export function hrAtResistance(rides, level) {
  return series(rides.filter((r) => r.resistance === level), (r) => (r.avgHr > 0 ? r.avgHr : null));
}

// Stopwatch: state is { running, startedAt, accumulated } so it survives closing the app.
export const WATCH_ZERO = Object.freeze({ running: false, startedAt: null, accumulated: 0 });

export const watch = {
  elapsed: (s, now) => (s ? s.accumulated + (s.running ? Math.max(0, now - s.startedAt) : 0) : 0),
  start: (s, now) => (s && s.running ? s : { running: true, startedAt: now, accumulated: s ? s.accumulated : 0 }),
  pause: (s, now) => (s && s.running ? { running: false, startedAt: null, accumulated: s.accumulated + Math.max(0, now - s.startedAt) } : s || WATCH_ZERO),
  reset: () => ({ ...WATCH_ZERO }),
};

/** Stopwatch time as whole minutes for the duration field (at least 1). */
export const watchMinutes = (ms) => Math.max(1, Math.round(ms / 60000));
