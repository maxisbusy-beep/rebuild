// Pure date helpers. Everything works in the phone's local time zone.

export const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as 'YYYY-MM-DD'. */
export function ymd(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** Parse 'YYYY-MM-DD' as local midnight. */
export function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local midnight of the given moment. */
export function startOfDay(d = new Date()) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Whole calendar days from a to b (b later = positive). DST-safe. */
export function daysBetween(a, b) {
  const A = startOfDay(a), B = startOfDay(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate())
    - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / DAY_MS);
}

/** Monday 00:00 (local) of the week containing d. Weeks run Mon-Sun. */
export function weekStart(d = new Date()) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0 ... Sun=6
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - dow);
}

/** 'YYYY-MM-DD' of the Monday of the week containing d. */
export function weekKey(d = new Date()) {
  return ymd(weekStart(d));
}

export function addDays(d, n) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + n, x.getHours(), x.getMinutes(), x.getSeconds());
}

/** 'today', 'yesterday', '5 days ago'. */
export function agoLabel(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekdayName(d = new Date()) { return WEEKDAYS[new Date(d).getDay()]; }

/** '16 November' or '16 Nov 2026' (short). */
export function prettyDate(d = new Date(), { short = false } = {}) {
  const x = new Date(d);
  return short
    ? `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)} ${x.getFullYear()}`
    : `${x.getDate()} ${MONTHS[x.getMonth()]}`;
}
