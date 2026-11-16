import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ymd, parseYmd, daysBetween, weekStart, weekKey, addDays, agoLabel, prettyDate, weekdayName } from '../js/dates.js';
import { weekStats, inWeek } from '../js/week.js';
import { withDefaults, maxHr, easyZone, DEFAULTS } from '../js/settings.js';

test('ymd and parseYmd round-trip in local time', () => {
  assert.equal(ymd(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(ymd(parseYmd('2026-11-16')), '2026-11-16');
});

test('daysBetween counts calendar days and survives clock changes', () => {
  assert.equal(daysBetween(new Date(2026, 10, 16, 23), new Date(2026, 10, 17, 0, 5)), 1);
  assert.equal(daysBetween(new Date(2026, 10, 16, 1), new Date(2026, 10, 16, 23)), 0);
  assert.equal(daysBetween(new Date(2026, 2, 1), new Date(2026, 3, 1)), 31); // spans a DST change in most zones
  assert.equal(daysBetween(new Date(2026, 10, 16), new Date(2026, 10, 10)), -6);
});

test('weeks start on Monday', () => {
  // 16 Nov 2026 is a Monday.
  assert.equal(new Date(2026, 10, 16).getDay(), 1);
  assert.equal(weekKey(new Date(2026, 10, 16, 0, 0)), '2026-11-16');
  assert.equal(weekKey(new Date(2026, 10, 18, 15)), '2026-11-16');
  assert.equal(weekKey(new Date(2026, 10, 22, 23, 59)), '2026-11-16', 'Sunday belongs to the week that began Monday');
  assert.equal(weekKey(new Date(2026, 10, 15, 12)), '2026-11-09', 'the Sunday before is the previous week');
  assert.equal(weekStart(new Date(2026, 10, 19, 18)).getHours(), 0);
});

test('weekStart crosses month and year boundaries', () => {
  assert.equal(weekKey(new Date(2027, 0, 1)), '2026-12-28'); // Fri 1 Jan 2027
  assert.equal(ymd(addDays(new Date(2026, 11, 28), 7)), '2027-01-04');
});

test('labels', () => {
  assert.equal(agoLabel(0), 'today');
  assert.equal(agoLabel(1), 'yesterday');
  assert.equal(agoLabel(9), '9 days ago');
  assert.equal(weekdayName(new Date(2026, 10, 16)), 'Monday');
  assert.equal(prettyDate(new Date(2026, 10, 16)), '16 November');
  assert.equal(prettyDate(new Date(2026, 10, 16), { short: true }), '16 Nov 2026');
});

test('inWeek includes Monday and Sunday, excludes neighbours', () => {
  const now = new Date(2026, 10, 18, 10); // Wed
  assert.equal(inWeek('2026-11-16', now), true);
  assert.equal(inWeek('2026-11-22', now), true);
  assert.equal(inWeek('2026-11-15', now), false);
  assert.equal(inWeek('2026-11-23', now), false);
});

test('weekStats counts finished lifts, rides and cardio minutes for this week only', () => {
  const now = new Date(2026, 10, 18, 10);
  const sessions = [
    { type: 'lift', date: '2026-11-16', finishedAt: 1 },
    { type: 'lift', date: '2026-11-17', finishedAt: 1 },
    { type: 'lift', date: '2026-11-18', finishedAt: null }, // still in progress
    { type: 'rest', date: '2026-11-18', finishedAt: 1 },    // not a lift
    { type: 'lift', date: '2026-11-14', finishedAt: 1 },    // last week
  ];
  const bike = [
    { date: '2026-11-16', duration: 35 },
    { date: '2026-11-18', duration: '40.4' },
    { date: '2026-11-18' },                 // no duration recorded
    { date: '2026-11-09', duration: 60 },   // last week
  ];
  assert.deepEqual(weekStats(sessions, bike, now), { lifts: 2, rides: 3, minutes: 75 });
  assert.deepEqual(weekStats([], [], now), { lifts: 0, rides: 0, minutes: 0 });
  assert.deepEqual(weekStats(undefined, undefined, now), { lifts: 0, rides: 0, minutes: 0 });
});

test('settings: defaults fill gaps, max HR is 220 minus age unless overridden', () => {
  assert.deepEqual(withDefaults(null), { ...DEFAULTS });
  assert.equal(withDefaults({ age: 40 }).proteinTarget, 190);
  assert.equal(maxHr(withDefaults(null)), 169);
  assert.equal(maxHr(withDefaults({ age: 40 })), 180);
  assert.equal(maxHr(withDefaults({ maxHr: 175 })), 175);
  assert.deepEqual(easyZone(withDefaults(null)), { low: 101, high: 118 });
});
