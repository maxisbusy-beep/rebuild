import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avgSpeed, cleanRide, series, resistanceLevels, hrAtResistance, watch, watchMinutes, WATCH_ZERO } from '../js/bike.js';
import { emptyDay, withDay, proteinTotal, addProtein, undoProtein, habitStreak, cleanFood } from '../js/daily.js';
import { checkinDue, pointsOf, movingAverage, weeklyMeans, weeklyChanges, droppedLifts, guidance } from '../js/body.js';
import { lineChart, yRange } from '../js/chart.js';
import { weekStats } from '../js/week.js';
import { daysSinceLast } from '../js/rotation.js';
import { buildBackup, parseBackup, replaceSnapshot, emptySnapshot } from '../js/backup.js';

const d = (day) => `2026-11-${String(day).padStart(2, '0')}`; // 16 Nov 2026 is a Monday
const T = (day) => new Date(2026, 10, day).getTime();

// ---------- Bike ----------

test('bike: average speed needs distance and duration', () => {
  assert.equal(avgSpeed({ distance: 15, duration: 30 }), 30);
  assert.equal(avgSpeed({ distance: 10, duration: 40 }), 15);
  assert.equal(avgSpeed({ distance: null, duration: 30 }), null);
  assert.equal(avgSpeed({ distance: 10, duration: 0 }), null);
});

test('bike: only duration is required; blank optional fields become null', () => {
  const res = cleanRide({ date: d(16), duration: '35', distance: '', resistance: undefined, avgHr: null, calories: '', feel: null, note: '  easy  ' }, d(16));
  assert.equal(res.ok, true);
  assert.deepEqual(res.ride, { date: d(16), duration: 35, distance: null, resistance: null, avgHr: null, calories: null, feel: null, note: 'easy' });
  const full = cleanRide({ date: d(15), duration: 40, distance: '18.5', resistance: '8', avgHr: '112', calories: '310', feel: 4, note: '' }, d(16));
  assert.equal(full.ok, true);
  assert.deepEqual([full.ride.distance, full.ride.resistance, full.ride.avgHr, full.ride.calories, full.ride.feel], [18.5, 8, 112, 310, 4]);
});

test('bike: rejects missing or silly values', () => {
  const bad = (patch) => cleanRide({ date: d(16), duration: 30, ...patch }, d(16));
  assert.equal(bad({ duration: '' }).ok, false);
  assert.equal(bad({ duration: 0 }).ok, false);
  assert.equal(bad({ duration: 'abc' }).ok, false);
  assert.equal(bad({ duration: 700 }).ok, false);
  assert.equal(bad({ avgHr: 400 }).ok, false);
  assert.equal(bad({ distance: -1 }).ok, false);
  assert.equal(bad({ distance: 'x' }).ok, false);
  assert.equal(bad({ date: d(17) }).ok, false, 'future date');
  assert.equal(bad({ date: '2026-02-31' }).ok, false, 'impossible date');
  assert.equal(bad({ date: '' }).ok, false);
  assert.equal(bad({ feel: 9 }).ride.feel, null);
});

test('bike: trend series are date-ordered and skip missing values', () => {
  const rides = [
    { date: d(12), duration: 30, distance: 12, resistance: 6, avgHr: 118 },
    { date: d(3), duration: 40, distance: 14, resistance: 6, avgHr: 124 },
    { date: d(8), duration: 30, distance: null, resistance: 8, avgHr: 130 },
    { date: d(10), duration: 20, distance: 9, resistance: 6, avgHr: null },
  ];
  assert.deepEqual(series(rides, (r) => r.distance).map((p) => p.y), [14, 9, 12]);
  assert.deepEqual(series(rides, avgSpeed).map((p) => p.y), [21, 27, 24]);
  assert.deepEqual(resistanceLevels(rides), [6, 8]);
  assert.deepEqual(hrAtResistance(rides, 6).map((p) => p.y), [124, 118]);
  assert.deepEqual(hrAtResistance(rides, 9), []);
  assert.deepEqual(resistanceLevels([]), []);
});

test('bike: rides count toward weekly minutes, ride count and days since last session', () => {
  const now = new Date(2026, 10, 18, 9);
  const rides = [{ date: d(16), duration: 35 }, { date: d(17), duration: 60 }, { date: d(14), duration: 45 }];
  assert.deepEqual(weekStats([], rides, now), { lifts: 0, rides: 2, minutes: 95 });
  assert.equal(daysSinceLast([], rides, now), 1);
});

test('stopwatch: start, pause, resume, reset; survives being reloaded mid-run', () => {
  let s = watch.reset();
  assert.deepEqual(s, WATCH_ZERO);
  assert.equal(watch.elapsed(s, 5000), 0);
  s = watch.start(s, 1000);
  assert.equal(watch.elapsed(s, 61000), 60000);
  assert.deepEqual(watch.start(s, 9999), s, 'starting twice changes nothing');
  s = watch.pause(s, 61000);
  assert.equal(watch.elapsed(s, 999999), 60000, 'paused time does not advance');
  s = watch.start(s, 100000);
  assert.equal(watch.elapsed(s, 130000), 90000);
  const reloaded = JSON.parse(JSON.stringify(s));
  assert.equal(watch.elapsed(reloaded, 160000), 120000);
  assert.equal(watch.elapsed(null, 5), 0);
  assert.deepEqual(watch.pause(null, 5), WATCH_ZERO);
  assert.equal(watchMinutes(29 * 60000 + 40000), 30);
  assert.equal(watchMinutes(10000), 1);
});

// ---------- Daily check-ins ----------

test('daily: protein tally adds, totals and undoes without mutating', () => {
  const day = emptyDay(d(16));
  const a = addProtein(day, 30, '', 1);
  const b = addProtein(a, 25, 'Whey', 2);
  assert.equal(proteinTotal(day), 0);
  assert.equal(proteinTotal(b), 55);
  assert.equal(b.protein[1].label, 'Whey');
  assert.equal(proteinTotal(undoProtein(b)), 30);
  assert.equal(proteinTotal(undoProtein(day)), 0);
  assert.equal(addProtein(day, 0), day);
  assert.equal(addProtein(day, -5), day);
  assert.equal(addProtein(day, 'abc'), day);
  assert.equal(addProtein(day, 9999), day);
});

test('daily: stored days are repaired with defaults', () => {
  assert.deepEqual(withDay(null, d(16)), emptyDay(d(16)));
  const w = withDay({ creatine: true, protein: 'oops' }, d(16));
  assert.equal(w.creatine, true);
  assert.deepEqual(w.protein, []);
  assert.equal(w.sleep, null);
  assert.equal(w.id, d(16));
});

test('daily: habit streak counts consecutive days and tolerates today not being ticked yet', () => {
  const days = (list) => list.map((n) => ({ date: d(n), creatine: true }));
  assert.equal(habitStreak([], 'creatine', d(16)), 0);
  assert.equal(habitStreak(days([16]), 'creatine', d(16)), 1);
  assert.equal(habitStreak(days([13, 14, 15, 16]), 'creatine', d(16)), 4);
  assert.equal(habitStreak(days([13, 14, 15]), 'creatine', d(16)), 3, 'today not ticked yet: streak stands');
  assert.equal(habitStreak(days([12, 13, 14]), 'creatine', d(16)), 0, 'missed yesterday: streak broken');
  assert.equal(habitStreak(days([11, 12, 14, 15, 16]), 'creatine', d(16)), 3, 'gap on the 13th');
  assert.equal(habitStreak([{ date: d(16), creatine: false, mobility: true }], 'creatine', d(16)), 0);
  // Across a month boundary.
  assert.equal(habitStreak([{ date: '2026-10-31', mobility: true }, { date: '2026-11-01', mobility: true }], 'mobility', '2026-11-01'), 2);
});

test('daily: saved foods need a name and sensible grams', () => {
  assert.deepEqual(cleanFood('  Whey shake ', '25'), { name: 'Whey shake', g: 25 });
  assert.equal(cleanFood('', 25), null);
  assert.equal(cleanFood('Eggs', 0), null);
  assert.equal(cleanFood('Eggs', 'x'), null);
});

// ---------- Body ----------

test('body: weekly check-in is due until there is an entry in the current Mon-Sun week', () => {
  const now = new Date(2026, 10, 18, 9); // Wed, week of 16th
  assert.equal(checkinDue([], now), true);
  assert.equal(checkinDue([{ date: d(15), weight: 111 }], now), true, 'last Sunday is the previous week');
  assert.equal(checkinDue([{ date: d(16), weight: 111 }], now), false);
  assert.equal(checkinDue([{ date: d(22), weight: 111 }], new Date(2026, 10, 22, 23)), false);
});

test('body: 4-week moving average uses only the trailing 28 days', () => {
  const pts = [{ t: T(1), y: 112 }, { t: T(8), y: 111 }, { t: T(15), y: 110 }, { t: T(22), y: 109 }, { t: T(29), y: 108 }];
  const ma = movingAverage(pts);
  assert.deepEqual(ma.map((p) => p.y), [112, 111.5, 111, 110.5, 109.5]);
  assert.deepEqual(ma.map((p) => p.t), pts.map((p) => p.t));
  assert.deepEqual(movingAverage([]), []);
});

test('body: points skip missing values; weekly means group by Mon-Sun week', () => {
  const entries = [
    { date: d(17), weight: 110.4, waist: null },
    { date: d(9), weight: 111, waist: 108 },
    { date: d(16), weight: 110, waist: 107 },
  ];
  assert.deepEqual(pointsOf(entries, 'waist').map((p) => p.y), [108, 107]);
  assert.deepEqual(pointsOf(entries, 'weight').map((p) => p.y), [111, 110, 110.4]);
  const means = weeklyMeans(entries);
  assert.deepEqual(means.map((m) => m.week), [d(9), d(16)]);
  assert.ok(Math.abs(means[1].mean - 110.2) < 1e-9);
});

test('body: weekly change is per week even when a week was skipped', () => {
  const e = [{ date: d(2), weight: 112 }, { date: d(9), weight: 111.6 }, { date: d(23), weight: 110.6 }];
  const c = weeklyChanges(e);
  assert.ok(Math.abs(c[0] - -0.4) < 1e-9);
  assert.ok(Math.abs(c[1] - -0.5) < 1e-9, '1 kg over two weeks = 0.5 per week');
});

test('body guidance: on track, too fast for two weeks, one fast week, holding, gaining', () => {
  const run = (...weights) => guidance(weights.map((w, i) => ({ date: d(2 + i * 7), weight: w })), [], new Date(2026, 10, 30));
  assert.equal(run().status, 'start');
  assert.equal(run(112).status, 'start');
  const on = run(112, 111.6);
  assert.equal(on.status, 'onTrack');
  assert.match(on.text, /down 0\.4 kg per week/);
  assert.equal(run(112, 111.75).status, 'onTrack', '0.25 is inside the target band');
  assert.equal(run(112, 111.5).status, 'onTrack', '0.5 is inside the target band');
  const fast = run(112, 111.2, 110.4);
  assert.equal(fast.status, 'tooFast');
  assert.match(fast.text, /Eat a little more/);
  assert.equal(run(112, 111.6, 110.8).status, 'fastWeek', 'only the latest week was fast');
  assert.equal(run(112, 111.2, 110.9).status, 'onTrack', 'slowed down again');
  assert.equal(run(112, 111.9).status, 'holding');
  assert.match(run(112, 112.6).text, /Up 0\.6 kg per week/);
});

test('body guidance: falling lifts suggest eating more', () => {
  const lift = (day, sets) => ({ id: `s${day}`, type: 'lift', date: d(day), startedAt: T(day), finishedAt: T(day) + 1, exercises: sets });
  const s = (weight, reps) => ({ weight, reps, rir: 2, done: true });
  const sessions = [
    lift(2, [{ exId: 'rdl', sets: [s(80, 10)] }, { exId: 'bbrow', sets: [s(60, 10)] }, { exId: 'deadlift', sets: [s(120, 5)] }]),
    lift(9, [{ exId: 'rdl', sets: [s(80, 7)] }, { exId: 'bbrow', sets: [s(60, 7)] }, { exId: 'deadlift', sets: [s(122.5, 5)] }]),
  ];
  const now = new Date(2026, 10, 12);
  assert.deepEqual(droppedLifts(sessions, now).sort(), ['Barbell row', 'Romanian deadlift']);
  const entries = [{ date: d(2), weight: 112 }, { date: d(9), weight: 111.6 }];
  assert.equal(guidance(entries, sessions, now).status, 'liftsDrop');
  assert.deepEqual(droppedLifts(sessions.slice(0, 1), now), [], 'needs two sessions');
  assert.deepEqual(droppedLifts(sessions, new Date(2027, 0, 20)), [], 'stale data is ignored');
  // A tiny dip (under 2.5%) is noise.
  const noise = [lift(2, [{ exId: 'rdl', sets: [s(100, 5)] }]), lift(9, [{ exId: 'rdl', sets: [s(97.5, 5)] }])];
  assert.deepEqual(droppedLifts(noise, now), []);
});

// ---------- Chart ----------

test('chart: draws lines and dots, never emits NaN, handles empty, single and flat data', () => {
  assert.equal(lineChart({ series: [{ points: [], style: 'line' }] }), '');
  const one = lineChart({ series: [{ points: [{ t: T(16), y: 111 }], style: 'line' }] });
  assert.match(one, /^<svg/);
  assert.equal(one.includes('NaN'), false);
  assert.equal(one.includes('<polyline'), false, 'one point has no line');
  assert.match(one, /16 Nov/);

  const flat = lineChart({ series: [{ points: [{ t: T(2), y: 110 }, { t: T(9), y: 110 }], style: 'line' }] });
  assert.equal(flat.includes('NaN'), false);
  assert.equal((flat.match(/<polyline/g) || []).length, 1);

  const two = lineChart({ series: [
    { points: [{ t: T(2), y: 112 }, { t: T(9), y: 111 }, { t: T(16), y: 110.2 }], style: 'faint' },
    { points: [{ t: T(2), y: 112 }, { t: T(9), y: 111.5 }, { t: T(16), y: 111.1 }], style: 'line' },
  ] });
  assert.equal((two.match(/<polyline/g) || []).length, 2);
  assert.equal((two.match(/<circle/g) || []).length, 6);
  assert.match(two, /2 Nov/);
  assert.match(two, /16 Nov/);
  assert.equal(two.includes('NaN'), false);
});

test('chart: y range pads the data and widens flat data', () => {
  const r = yRange([100, 110]);
  assert.ok(r.lo < 100 && r.hi > 110);
  const flat = yRange([50, 50]);
  assert.ok(flat.hi - flat.lo > 1);
});

// ---------- Backup covers the new data ----------

test('backup round-trips bike sessions, daily check-ins, body check-ins, photos and saved foods', () => {
  const snap = {
    ...emptySnapshot(),
    kv: [{ id: 'foods', value: [{ name: 'Whey', g: 25 }], updatedAt: 5 }],
    bike: [{ id: 'b1', date: d(16), duration: 35, distance: 14, resistance: 6, avgHr: 118, calories: null, feel: 4, note: '', updatedAt: 6 }],
    daily: [{ id: d(16), date: d(16), protein: [{ g: 30, label: '', at: 1 }], creatine: true, mobility: false, sleep: 7.5, updatedAt: 7 }],
    body: [{ id: 'w1', date: d(16), weight: 111, waist: 108, photoId: 'p1', updatedAt: 8 }],
    photos: [{ id: 'p1', dataUrl: 'data:image/jpeg;base64,AAAA', updatedAt: 9 }],
  };
  const res = parseBackup(JSON.stringify(buildBackup(snap)));
  assert.equal(res.ok, true);
  assert.deepEqual(replaceSnapshot(res.backup), snap);
});
