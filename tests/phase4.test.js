import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deloadSets, deloadStatus, startDeload, endDeload, skipDeload, normalizeDeload } from '../js/deload.js';
import { exerciseSeries, loggedExercises, muscleVolume, sessionsPerWeek, recordsList, heatmap, shoulderReport } from '../js/stats.js';
import { performances, suggest, isStalled } from '../js/progression.js';
import { buildSession, finishSession } from '../js/session.js';
import { defaultProgram } from '../js/program.js';
import { EXERCISES } from '../js/exercises.js';
import { barChart } from '../js/chart.js';

// 16 Nov 2026 is a Monday. Dates may run past the end of a month: the Date constructor rolls them over.
const at = (monthIndex, day, h = 10) => new Date(2026, monthIndex, day, h);
const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const set = (weight, reps, rir = 2) => ({ weight, reps, rir, done: true });
let seq = 0;
function lift(dt, exercises = {}, extra = {}) {
  return {
    id: `p${++seq}`, type: 'lift', workoutKey: 'lowerA', date: ymd(dt), startedAt: dt.getTime(), finishedAt: dt.getTime() + 3600000,
    exercises: Object.entries(exercises).map(([exId, v]) => (Array.isArray(v) ? { exId, sets: v } : { exId, ...v })),
    ...extra,
  };
}

// ---------- Deload ----------

test('deload: about 60% of the sets, never fewer than one', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(deloadSets), [1, 1, 2, 2, 3, 4]);
});

test('deload: suggested in the 6th week after the first lifting session', () => {
  const sessions = [lift(at(9, 5))]; // Mon 5 Oct 2026 = week 1
  const st = normalizeDeload(null);
  assert.deepEqual(deloadStatus([], st, at(10, 16)), { active: false, due: false, weekNumber: 0 });
  assert.equal(deloadStatus(sessions, st, at(9, 5)).weekNumber, 1);
  assert.equal(deloadStatus(sessions, st, at(9, 11, 23)).weekNumber, 1, 'Sunday is still week 1');
  assert.equal(deloadStatus(sessions, st, at(9, 12)).weekNumber, 2);
  const w5 = deloadStatus(sessions, st, at(10, 2));
  assert.deepEqual([w5.weekNumber, w5.due], [5, false]);
  const w6 = deloadStatus(sessions, st, at(10, 9));
  assert.deepEqual([w6.weekNumber, w6.due, w6.active], [6, true, false]);
  assert.equal(deloadStatus(sessions, st, at(10, 16)).due, true, 'still due in week 7 if it was not taken');
});

test('deload: starting it makes the week active and restarts the count from the following week', () => {
  const sessions = [lift(at(9, 5))];
  let st = startDeload(null, at(10, 9));
  assert.deepEqual(st.weeks, ['2026-11-09']);
  const during = deloadStatus(sessions, st, at(10, 12));
  assert.deepEqual([during.active, during.due], [true, false]);
  const after = deloadStatus(sessions, st, at(10, 16));
  assert.deepEqual([after.active, after.due, after.weekNumber], [false, false, 1]);
  assert.equal(deloadStatus(sessions, st, at(11, 21)).due, true, 'six weeks later it is due again');
  assert.equal(deloadStatus(sessions, st, at(11, 14)).due, false);
  st = endDeload(st, at(10, 12));
  assert.deepEqual(st.weeks, []);
  assert.equal(deloadStatus(sessions, st, at(10, 12)).due, true);
  assert.deepEqual(startDeload(startDeload(null, at(10, 9)), at(10, 10)).weeks, ['2026-11-09'], 'starting twice in a week is harmless');
});

test('deload: on request works at any time; skipping hides the suggestion for that week only', () => {
  const sessions = [lift(at(9, 5))];
  const early = startDeload(null, at(9, 19));
  assert.equal(deloadStatus(sessions, early, at(9, 20)).active, true);
  const skipped = skipDeload(null, at(10, 9));
  assert.equal(deloadStatus(sessions, skipped, at(10, 13)).due, false);
  assert.equal(deloadStatus(sessions, skipped, at(10, 16)).due, true);
  assert.deepEqual(normalizeDeload({ weeks: ['x', '2026-11-09', '2026-11-09'], skipped: 5 }), { weeks: ['2026-11-09'], skipped: null });
});

test('deload workout: fewer sets, same weight, 3+ reps in reserve, flagged as deload', () => {
  const top = [lift(at(10, 2), { rdl: [set(60, 10), set(60, 10), set(60, 10)] })];
  const s = buildSession(defaultProgram(), 'lowerA', top, { deload: true, now: at(10, 9).getTime() });
  assert.equal(s.deload, true);
  const rdl = s.exercises[0];
  assert.equal(rdl.sets.length, 2);
  assert.deepEqual(rdl.sets.map((x) => [x.weight, x.reps, x.rir]), [[60, 10, 3], [60, 10, 3]], 'no weight increase in a deload');
  assert.deepEqual(s.exercises.map((e) => e.sets.length), [2, 2, 2, 2]);
  const upper = buildSession(defaultProgram(), 'upperA', [], { deload: true });
  assert.equal(upper.exercises.find((e) => e.exId === 'dbcurl').sets.length, 1);
  assert.equal(buildSession(defaultProgram(), 'lowerA', top, {}).deload, false);
});

test('deload sessions do not count as a stall and do not block the next increase', () => {
  const item = { exId: 'rdl', sets: 3, repMin: 8, repMax: 10 };
  const sessions = [
    lift(at(10, 2), { rdl: [set(60, 10), set(60, 10), set(60, 10)] }),
    lift(at(10, 9), { rdl: [set(60, 10, 4), set(60, 10, 4)] }, { deload: true }),
    lift(at(10, 11), { rdl: [set(60, 10, 4), set(60, 10, 4)] }, { deload: true }),
  ];
  const h = performances(sessions, 'rdl');
  assert.equal(h.length, 1, 'deload sessions are left out of progression history');
  assert.equal(performances(sessions, 'rdl', { all: true }).length, 3);
  assert.equal(isStalled(h, item), false);
  const s = suggest(EXERCISES.rdl, item, h);
  assert.deepEqual([s.action, s.weight], ['increase', 65]);
});

// ---------- Progress stats ----------

test('exercise series: top set weight and estimated 1RM per session, oldest first, deloads included', () => {
  const sessions = [
    lift(at(10, 9), { rdl: [set(62.5, 8), set(62.5, 8)] }),
    lift(at(10, 2), { rdl: [set(60, 10), set(55, 12)] }),
    lift(at(10, 16), { rdl: [set(62.5, 8)] }, { deload: true }),
    lift(at(10, 4), { chinup: [set(0, 6), set(0, 8)] }),
  ];
  const s = exerciseSeries(sessions, 'rdl');
  assert.deepEqual(s.map((p) => p.top), [60, 62.5, 62.5]);
  assert.deepEqual(s.map((p) => Number(p.e1rm.toFixed(1))), [80, 79.2, 79.2]);
  assert.deepEqual(exerciseSeries(sessions, 'chinup').map((p) => [p.top, p.e1rm, p.best]), [[0, 0, 8]]);
  assert.deepEqual(exerciseSeries(sessions, 'deadlift'), []);
  assert.deepEqual(loggedExercises(sessions), ['rdl', 'chinup']);
  assert.deepEqual(loggedExercises([]), []);
});

test('weekly muscle volume: main muscle gets a full set, supporting muscles half, this week vs last', () => {
  const now = at(10, 18);
  const sessions = [
    lift(at(10, 16), { rdl: [set(60, 10), set(60, 10), set(60, 10)], dbcurl: [set(10, 12), set(10, 12)] }),
    lift(at(10, 17), { dbbench: [set(20, 8), set(20, 8), { weight: 20, reps: 8, rir: 2, done: false }] }),
    lift(at(10, 10), { rdl: [set(60, 10)] }),
    { ...lift(at(10, 18), { rdl: [set(60, 10)] }), finishedAt: null },
  ];
  const v = Object.fromEntries(muscleVolume(sessions, now).map((m) => [m.muscle, [m.sets, m.prev]]));
  assert.deepEqual(v.hamstrings, [3, 1]);
  assert.deepEqual(v.glutes, [1.5, 0.5]);
  assert.deepEqual(v.back, [1.5, 0.5]);
  assert.deepEqual(v.biceps, [2, 0]);
  assert.deepEqual(v.chest, [2, 0]);
  assert.deepEqual(v.triceps, [1, 0]);
  assert.deepEqual(v.quads, [0, 0]);
  assert.equal(muscleVolume([], now).length, 10);
});

test('sessions per week: last 8 weeks, oldest first, lifts and rides counted separately', () => {
  const now = at(10, 18);
  const sessions = [lift(at(10, 16)), lift(at(10, 17)), lift(at(10, 9)), lift(at(8, 1)), { id: 'r', type: 'rest', date: '2026-11-16', finishedAt: 1 }];
  const bike = [{ date: '2026-11-16', duration: 30 }, { date: '2026-11-08', duration: 30 }];
  const w = sessionsPerWeek(sessions, bike, now);
  assert.equal(w.length, 8);
  assert.equal(w[7].week, '2026-11-16');
  assert.equal(w[0].week, '2026-09-28');
  assert.deepEqual([w[7].lifts, w[7].rides], [2, 1]);
  assert.deepEqual([w[6].lifts, w[6].rides], [1, 0]);
  assert.deepEqual([w[5].lifts, w[5].rides], [0, 1], 'Sunday 8 Nov belongs to the week of 2 Nov');
  assert.equal(w.reduce((n, x) => n + x.lifts, 0), 3, 'sessions older than 8 weeks are not shown');
});

test('records list: heaviest set with estimated 1RM, most reps for bodyweight, longest hold for timed', () => {
  const sessions = [
    lift(at(10, 2), { rdl: [set(60, 10), set(65, 6)], chinup: [set(0, 6)], plank: [set(0, 45)], facepull: [set(0, 15)] }),
    lift(at(10, 9), { rdl: [set(65, 8)], chinup: [set(0, 9)], plank: [set(0, 60)] }),
  ];
  const r = Object.fromEntries(recordsList(sessions).map((x) => [x.exId, [x.main, x.sub]]));
  assert.deepEqual(r.rdl, ['65 kg × 8', 'Estimated 1RM 82.3 kg']);
  assert.deepEqual(r.chinup, ['9 reps', 'Most reps in a set']);
  assert.deepEqual(r.plank, ['60 s', 'Longest hold']);
  assert.deepEqual(r.facepull, ['15 reps', 'Most reps in a set']);
  assert.deepEqual(recordsList([]), []);
});

test('calendar heat-map: 12 Mon-Sun weeks ending this week, marking lift, bike, rest and future days', () => {
  const now = at(10, 18); // Wed
  const sessions = [lift(at(10, 16)), lift(at(10, 18)), { id: 'r', type: 'rest', date: '2026-11-17', finishedAt: 1 }];
  const bike = [{ date: '2026-11-18', duration: 30 }, { date: '2026-09-01', duration: 30 }];
  const weeks = heatmap(sessions, bike, now);
  assert.equal(weeks.length, 12);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0][0].date, '2026-08-31');
  assert.equal(weeks[0][1].bike, true);
  const last = weeks[11];
  assert.deepEqual(last.map((d) => d.date), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual([last[0].lift, last[0].bike], [true, false]);
  assert.deepEqual([last[1].rest, last[1].lift], [true, false]);
  assert.deepEqual([last[2].lift, last[2].bike, last[2].future], [true, true, false]);
  assert.deepEqual(last.map((d) => d.future), [false, false, false, true, true, true, true]);
});

test('shoulder report: counts pops and pain per upper exercise, worst first', () => {
  const ex = (flag) => ({ sets: [set(20, 8)], flag });
  const sessions = [
    lift(at(10, 3), { dbbench: ex('pop'), dbohp: ex('pain'), bbrow: ex('none'), rdl: ex('pain') }),
    lift(at(10, 10), { dbbench: ex('pop'), dbohp: ex(null), bbrow: ex(null) }),
    lift(at(10, 17), { dbbench: ex('none'), bandlat: ex('pop') }),
    { ...lift(at(10, 18), { dbbench: ex('pain') }), finishedAt: null },
  ];
  const r = shoulderReport(sessions);
  assert.deepEqual(r.map((x) => x.exId), ['dbohp', 'dbbench', 'bandlat']);
  assert.deepEqual(r[0], { exId: 'dbohp', name: EXERCISES.dbohp.name, logged: 2, pop: 0, pain: 1, last: '2026-11-03' });
  assert.deepEqual([r[1].logged, r[1].pop, r[1].pain, r[1].last], [3, 2, 0, '2026-11-10']);
  assert.equal(r.some((x) => x.exId === 'rdl'), false, 'lower-body exercises are not part of the report');
  assert.equal(r.some((x) => x.exId === 'bbrow'), false, 'exercises that were always fine are left out');
  assert.deepEqual(shoulderReport([]), []);
});

test('finishing a deload session keeps its flag and still computes a summary', () => {
  const s = buildSession(defaultProgram(), 'lowerA', [], { deload: true, now: at(10, 9).getTime() });
  s.id = 'd1';
  s.exercises[0].sets[0] = { ...s.exercises[0].sets[0], weight: 60, done: true };
  const done = finishSession(s, [s], at(10, 9).getTime() + 1800000);
  assert.equal(done.deload, true);
  assert.equal(done.volume, 480);
});

// ---------- Bar chart ----------

test('bar chart: one stacked bar per week, target line, no NaN, empty when there is no data', () => {
  assert.equal(barChart({ bars: [] }), '');
  const svg = barChart({ target: 4, bars: [
    { t: at(10, 2).getTime(), a: 3, b: 1 }, { t: at(10, 9).getTime(), a: 0, b: 0 }, { t: at(10, 16).getTime(), a: 4, b: 2 },
  ] });
  assert.match(svg, /^<svg/);
  assert.equal((svg.match(/class="ch-bar a"/g) || []).length, 2);
  assert.equal((svg.match(/class="ch-bar b"/g) || []).length, 2);
  assert.equal((svg.match(/ch-target/g) || []).length, 1);
  assert.equal(svg.includes('NaN'), false);
  assert.match(svg, />6</);
  const zero = barChart({ bars: [{ t: 0, a: 0, b: 0 }] });
  assert.equal(zero.includes('NaN'), false);
});
