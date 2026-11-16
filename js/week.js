// Pure weekly-target maths (Mon-Sun weeks).
import { weekStart, addDays, parseYmd } from './dates.js';

export const TARGETS = {
  lifts: 4,
  ridesMin: 2,
  ridesMax: 3,
  cardioMin: 90,
  cardioMax: 150,
};

/** True if a 'YYYY-MM-DD' date falls in the Mon-Sun week containing `now`. */
export function inWeek(dateStr, now = new Date()) {
  const start = weekStart(now);
  const end = addDays(start, 7);
  const d = parseYmd(dateStr);
  return d >= start && d < end;
}

/**
 * This week's totals.
 * sessions: [{ type: 'lift', date: 'YYYY-MM-DD', finishedAt }]
 * bike:     [{ date: 'YYYY-MM-DD', duration: minutes }]
 */
export function weekStats(sessions = [], bike = [], now = new Date()) {
  const lifts = sessions.filter((s) => s.type === 'lift' && s.finishedAt && inWeek(s.date, now)).length;
  const rides = bike.filter((b) => inWeek(b.date, now));
  const minutes = rides.reduce((sum, b) => sum + (Number(b.duration) || 0), 0);
  return { lifts, rides: rides.length, minutes: Math.round(minutes) };
}
