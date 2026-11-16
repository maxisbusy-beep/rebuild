import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES } from '../js/exercises.js';
import { DEFAULT_PROGRAM, defaultProgram, normalizeProgram, normalizeItem, swapItem, rxLabel } from '../js/program.js';
import { performances, hitTop, isStalled, suggest, prefillSets } from '../js/progression.js';
import { epley, exercisePRs } from '../js/records.js';
import { nextWorkoutKey, daysSinceLast, gapLevel, weekStreak, rampActive } from '../js/rotation.js';
import { buildSession, finishSession, sessionVolume } from '../js/session.js';
import { fmtKg, fmtClock, fmtDuration, fmtInt, setsLabel } from '../js/format.js';

const day = (d, h = 10) => new Date(2026, 10, d, h).getTime(); // November 2026; the 16th is a Monday
const ymdOf = (d) => `2026-11-${String(d).padStart(2, '0')}`;
const set = (weight, reps, rir = 2) => ({ weight, reps, rir, done: true });
let seq = 0;
function lift(d, workoutKey, exercises = {}) {
  return {
    id: `s${++seq}`, type: 'lift', workoutKey, date: ymdOf(d), startedAt: day(d), finishedAt: day(d, 11),
    exercises: Object.entries(exercises).map(([exId, sets]) => ({ exId, sets })),
  };
}
const perf = (...sets) => ({ date: 'x', sets });
const RDL = EXERCISES.rdl, rdlItem = { exId: 'rdl', sets: 3, repMin: 8, repMax: 10 };

// ---------- Exercise library and program ----------

test('library: no dips and no weighted lateral raises anywhere', () => {
  for (const [id, e] of Object.entries(EXERCISES)) {
    assert.equal(/\bdips?\b/i.test(e.name), false, `${id} is a dip`);
    if (/lateral raise/i.test(e.name)) assert.equal(e.equip, 'band', `${id}: lateral raises must be band only`);
  }
});

test('library: every exercise is well formed and swaps point at real exercises', () => {
  for (const [id, e] of Object.entries(EXERCISES)) {
    assert.ok(e.name && e.cue, `${id} needs a name and cue`);
    assert.ok(['bb', 'db', 'band', 'bw'].includes(e.equip), `${id} equipment`);
    assert.ok(['compound', 'accessory'].includes(e.kind));
    assert.ok(['reps', 'amrap', 'time'].includes(e.mode));
    assert.ok(e.muscles.length && e.muscles.every((m) => MUSCLES.includes(m)), `${id} muscles`);
    assert.ok(e.swaps.length >= 1, `${id} needs at least one alternative`);
    for (const s of e.swaps) {
      assert.ok(EXERCISES[s], `${id} swap "${s}" does not exist`);
      assert.notEqual(s, id);
    }
  }
});

test('library: increments are 5 kg for deadlift, RDL and hip thrust, 2.5 kg for other barbell lifts', () => {
  assert.equal(EXERCISES.deadlift.inc, 5);
  assert.equal(EXERCISES.rdl.inc, 5);
  assert.equal(EXERCISES.hipthrust.inc, 5);
  assert.equal(EXERCISES.bbrow.inc, 2.5);
  assert.equal(EXERCISES.floorpress.inc, 2.5);
  assert.equal(EXERCISES.frontsquat.inc, 2.5);
});

test('program: default matches the brief', () => {
  const p = DEFAULT_PROGRAM;
  assert.deepEqual(p.order, ['lowerA', 'upperA', 'lowerB', 'upperB']);
  const labels = (k) => p.workouts[k].items.map((it) => `${EXERCISES[it.exId].name} ${rxLabel(it)}`);
  assert.deepEqual(labels('lowerA'), [
    'Romanian deadlift 3 × 8–10', 'Bulgarian split squat 3 × 8–10 each side',
    'Goblet squat 3 × 10–12', 'Plank 3 × 45 s']);
  assert.deepEqual(labels('upperA'), [
    'Dumbbell bench press 3 × 6–10', 'Barbell row 3 × 8–10', 'Chin-ups 3 × AMRAP',
    'Band face pull 3 × 15', 'Dumbbell curl 2 × 10–12']);
  assert.deepEqual(labels('lowerB'), [
    'Deadlift 3 × 5', 'Front squat (from floor) 3 × 8–10', 'Hip thrust 3 × 10–12', 'Calf raise 3 × 15']);
  assert.deepEqual(labels('upperB'), [
    'Neutral-grip dumbbell overhead press 3 × 8–10', 'One-arm dumbbell row 3 × 10 each side',
    'Barbell floor press 3 × 6–8', 'Push-ups 3 × AMRAP', 'Band lateral raise (light) 3 × 15',
    'Band triceps pushdown 2 × 12']);
  assert.ok(EXERCISES.frontsquat.swaps.includes('goblet'), 'goblet squat is offered instead of front squat');
});

test('program: upper exercises carry the shoulder flag, lower ones do not', () => {
  for (const k of ['upperA', 'upperB']) for (const it of DEFAULT_PROGRAM.workouts[k].items) assert.equal(EXERCISES[it.exId].upper, true);
  for (const k of ['lowerA', 'lowerB']) for (const it of DEFAULT_PROGRAM.workouts[k].items) assert.equal(EXERCISES[it.exId].upper, false);
});

test('program: normalize repairs bad data and falls back to defaults', () => {
  assert.deepEqual(normalizeProgram(null), defaultProgram());
  assert.deepEqual(normalizeProgram({ workouts: {} }), defaultProgram());
  const p = defaultProgram();
  p.workouts.lowerA.items = [{ exId: 'nope', sets: 3 }, { exId: 'rdl', sets: 99, repMin: 12, repMax: 8 }];
  const n = normalizeProgram(p);
  assert.deepEqual(n.workouts.lowerA.items, [{ exId: 'rdl', sets: 8, repMin: 8, repMax: 12 }]);
  p.workouts.lowerA.items = [{ exId: 'nope' }];
  assert.deepEqual(normalizeProgram(p).workouts.lowerA.items, defaultProgram().workouts.lowerA.items, 'empty workout falls back');
  assert.equal(normalizeItem({ exId: 'chinup', sets: 3, repMin: 5, repMax: 9 }).repMax, null);
  assert.deepEqual(normalizeItem({ exId: 'plank', sets: 3, repMin: 10, repMax: 60 }), { exId: 'plank', sets: 3, repMin: 60, repMax: 60 });
});

test('program: swapping keeps sets, keeps the rep range only between plain rep exercises', () => {
  assert.deepEqual(swapItem({ exId: 'rdl', sets: 4, repMin: 6, repMax: 8 }, 'dbrdl'), { exId: 'dbrdl', sets: 4, repMin: 6, repMax: 8 });
  assert.deepEqual(swapItem({ exId: 'chinup', sets: 3, repMin: 5, repMax: null }, 'chinneg'), { exId: 'chinneg', sets: 3, repMin: 4, repMax: 6 });
  assert.deepEqual(swapItem({ exId: 'plank', sets: 3, repMin: 45, repMax: 45 }, 'deadbug'), { exId: 'deadbug', sets: 3, repMin: 10, repMax: 10 });
});

// ---------- Rotation ----------

test('rotation: Lower A, Upper A, Lower B, Upper B, then round again', () => {
  const order = DEFAULT_PROGRAM.order;
  const done = [];
  const seen = [];
  for (let i = 0; i < 9; i++) {
    const k = nextWorkoutKey(order, done);
    seen.push(k);
    done.push(lift(1 + i, k));
  }
  assert.deepEqual(seen, ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerA', 'upperA', 'lowerB', 'upperB', 'lowerA']);
});

test('rotation: rest days, bike days and unfinished workouts do not advance it', () => {
  const order = DEFAULT_PROGRAM.order;
  const sessions = [
    lift(2, 'lowerA'),
    { id: 'r', type: 'rest', date: ymdOf(3), finishedAt: day(3) },
    { ...lift(4, 'upperA'), finishedAt: null },
  ];
  assert.equal(nextWorkoutKey(order, sessions), 'upperA');
  assert.equal(nextWorkoutKey(order, []), 'lowerA');
  assert.equal(nextWorkoutKey(order, [{ ...lift(2, 'gone') }]), 'lowerA', 'unknown key restarts the rotation');
});

test('rotation: uses the most recent session regardless of list order', () => {
  const sessions = [lift(5, 'lowerB'), lift(2, 'lowerA'), lift(3, 'upperA')];
  assert.equal(nextWorkoutKey(DEFAULT_PROGRAM.order, sessions), 'upperB');
});

test('days since last session counts lifts and bike, flags amber at 3 and red at 5', () => {
  const now = new Date(2026, 10, 16, 9);
  assert.equal(daysSinceLast([], [], now), null);
  assert.equal(daysSinceLast([lift(16, 'lowerA')], [], now), 0);
  assert.equal(daysSinceLast([lift(10, 'lowerA')], [{ date: ymdOf(14), duration: 30 }], now), 2);
  assert.equal(daysSinceLast([lift(13, 'lowerA'), { id: 'r', type: 'rest', date: ymdOf(15), finishedAt: 1 }], [], now), 3, 'rest days do not count');
  assert.deepEqual([null, 0, 2, 3, 4, 5, 9].map(gapLevel), ['ok', 'ok', 'ok', 'amber', 'amber', 'red', 'red']);
});

// ---------- Streak and ramp ----------

test('week streak: consecutive Mon-Sun weeks with 3+ lifts', () => {
  const now = new Date(2026, 10, 18, 12); // Wed 18 Nov, week of the 16th
  const wk = (...days) => days.map((d) => lift(d, 'lowerA'));
  assert.equal(weekStreak([], now), 0);
  // Weeks of 2nd and 9th both have 3; current week has 1 so far: streak stays alive at 2.
  assert.equal(weekStreak([...wk(2, 4, 6), ...wk(9, 11, 13), ...wk(16)], now), 2);
  // Current week reaches 3: it counts.
  assert.equal(weekStreak([...wk(2, 4, 6), ...wk(9, 11, 13), ...wk(16, 17, 18)], now), 3);
  // Last week only had 2: the streak is broken, whatever came before.
  assert.equal(weekStreak([...wk(2, 4, 6), ...wk(9, 11), ...wk(16)], now), 0);
  assert.equal(weekStreak([...wk(2, 4, 6), ...wk(9, 11), ...wk(16, 17, 18)], now), 1);
  // Sunday belongs to the week that started on Monday.
  assert.equal(weekStreak(wk(9, 14, 15), now), 1);
});

test('ramp-in lasts 14 days from the first lifting session', () => {
  assert.equal(rampActive([], new Date(2026, 10, 16)), true);
  const first = [lift(2, 'lowerA')];
  assert.equal(rampActive(first, new Date(2026, 10, 2, 20)), true);
  assert.equal(rampActive(first, new Date(2026, 10, 15, 23)), true);  // day 13
  assert.equal(rampActive(first, new Date(2026, 10, 16, 0, 5)), false); // day 14
  assert.equal(rampActive([{ ...lift(2, 'lowerA'), finishedAt: null }], new Date(2026, 10, 30)), true, 'unfinished sessions do not start the clock');
});

// ---------- Progression ----------

test('performances: finished lifts only, oldest first, completed sets only', () => {
  const sessions = [
    lift(5, 'lowerA', { rdl: [set(62.5, 8)] }),
    lift(2, 'lowerA', { rdl: [set(60, 10), { weight: 60, reps: 9, rir: 1, done: false }] }),
    { ...lift(7, 'lowerA', { rdl: [set(70, 5)] }), finishedAt: null },
    lift(6, 'upperA', { dbbench: [set(20, 8)] }),
  ];
  const p = performances(sessions, 'rdl');
  assert.deepEqual(p.map((x) => x.date), [ymdOf(2), ymdOf(5)]);
  assert.equal(p[0].sets.length, 1);
});

test('double progression: every set at the top with RIR >= 1 earns an increase', () => {
  const h = [perf(set(60, 10, 2), set(60, 10, 1), set(60, 10, 1))];
  assert.equal(hitTop(h[0], rdlItem), true);
  const s = suggest(RDL, rdlItem, h);
  assert.equal(s.action, 'increase');
  assert.equal(s.weight, 65, 'RDL goes up 5 kg');
  assert.equal(suggest(EXERCISES.deadlift, { sets: 3, repMin: 5, repMax: 5 }, [perf(set(100, 5), set(100, 5), set(100, 5))]).weight, 105);
  assert.equal(suggest(EXERCISES.hipthrust, { sets: 3, repMin: 10, repMax: 12 }, [perf(set(80, 12), set(80, 12), set(80, 13))]).weight, 85);
  assert.equal(suggest(EXERCISES.bbrow, rdlItem, h).weight, 62.5, 'other barbell lifts go up 2.5 kg');
  assert.equal(suggest(EXERCISES.floorpress, { sets: 3, repMin: 6, repMax: 8 }, [perf(set(50, 8), set(50, 8), set(50, 8))]).weight, 52.5);
});

test('double progression: no increase if any set is short, at RIR 0, or a set is missing', () => {
  assert.equal(suggest(RDL, rdlItem, [perf(set(60, 10), set(60, 10), set(60, 9))]).action, 'hold');
  assert.equal(suggest(RDL, rdlItem, [perf(set(60, 10), set(60, 10), set(60, 10, 0))]).action, 'hold');
  assert.equal(suggest(RDL, rdlItem, [perf(set(60, 10), set(60, 10))]).action, 'hold');
  assert.equal(suggest(RDL, rdlItem, [perf(set(60, 10), set(60, 10), { weight: 60, reps: 10, rir: null })]).action, 'hold');
  const hold = suggest(RDL, rdlItem, [perf(set(60, 10), set(60, 9), set(60, 8))]);
  assert.equal(hold.weight, 60);
  assert.match(hold.text, /Stay at 60 kg/);
});

test('double progression: dumbbells suggest the next size, bands a heavier band', () => {
  const db = suggest(EXERCISES.dbbench, { sets: 3, repMin: 6, repMax: 10 }, [perf(set(24, 10), set(24, 10), set(24, 10))]);
  assert.equal(db.action, 'increase');
  assert.equal(db.weight, null);
  assert.match(db.text, /next dumbbell size/);
  const band = suggest(EXERCISES.facepull, { sets: 3, repMin: 15, repMax: 15 }, [perf(set(0, 15), set(0, 15), set(0, 15))]);
  assert.equal(band.action, 'increase');
  assert.match(band.text, /heavier band/);
});

test('ramp weeks suppress weight increases', () => {
  const h = [perf(set(60, 10), set(60, 10), set(60, 10))];
  const s = suggest(RDL, rdlItem, h, { ramp: true });
  assert.equal(s.action, 'hold');
  assert.equal(s.weight, 60);
  assert.match(s.text, /Ramp weeks/);
  assert.match(suggest(RDL, rdlItem, [], { ramp: true }).text, /3\+ reps in reserve/);
});

test('stall: 3 sessions at the same weight without progress suggests a 10% drop', () => {
  const flat = [perf(set(60, 9), set(60, 8), set(60, 8)), perf(set(60, 9), set(60, 8), set(60, 7)), perf(set(60, 9), set(60, 8), set(60, 8))];
  assert.equal(isStalled(flat, rdlItem), true);
  const s = suggest(RDL, rdlItem, flat);
  assert.equal(s.action, 'reduce');
  assert.equal(s.weight, 55, '60 kg less 10% = 54, rounded to the nearest 2.5');
  assert.match(s.text, /Stalled/);
  assert.equal(suggest(EXERCISES.deadlift, { sets: 3, repMin: 5, repMax: 5 }, [perf(set(140, 4)), perf(set(140, 4)), perf(set(140, 3))]).weight, 125);
  assert.equal(suggest(EXERCISES.dbbench, { sets: 3, repMin: 6, repMax: 10 }, [perf(set(24, 7)), perf(set(24, 7)), perf(set(24, 7))]).weight, 22);
});

test('stall: not flagged while reps climb, weight changes, there are under 3 sessions, or in ramp weeks', () => {
  const climbing = [perf(set(60, 8), set(60, 8), set(60, 8)), perf(set(60, 9), set(60, 8), set(60, 8)), perf(set(60, 9), set(60, 9), set(60, 8))];
  assert.equal(isStalled(climbing, rdlItem), false);
  const changed = [perf(set(57.5, 9)), perf(set(60, 8)), perf(set(60, 8))];
  assert.equal(isStalled(changed, rdlItem), false);
  assert.equal(isStalled([perf(set(60, 8)), perf(set(60, 8))], rdlItem), false);
  const flat = [perf(set(60, 8)), perf(set(60, 8)), perf(set(60, 8))];
  assert.equal(suggest(RDL, rdlItem, flat, { ramp: true }).action, 'hold');
  // A fourth flat session after an earlier good one is still a stall on the last three.
  assert.equal(isStalled([perf(set(55, 10), set(55, 10), set(55, 10)), ...flat], rdlItem), true);
});

test('AMRAP and timed exercises get rep and time targets, never a weight', () => {
  const chin = suggest(EXERCISES.chinup, { sets: 3, repMin: 5, repMax: null }, [perf(set(0, 6), set(0, 5), set(0, 4))]);
  assert.equal(chin.action, 'reps');
  assert.match(chin.text, /15 total reps/);
  const plankItem = { sets: 3, repMin: 45, repMax: 45 };
  assert.equal(suggest(EXERCISES.plank, plankItem, [perf(set(0, 45), set(0, 45), set(0, 45))]).action, 'increase');
  assert.equal(suggest(EXERCISES.plank, plankItem, [perf(set(0, 45), set(0, 40), set(0, 30))]).action, 'hold');
});

test('prefill: copies last session; bumps weight and resets reps on an increase', () => {
  const none = prefillSets(RDL, rdlItem, [], suggest(RDL, rdlItem, []));
  assert.deepEqual(none, [{ weight: 0, reps: 8, rir: 2 }, { weight: 0, reps: 8, rir: 2 }, { weight: 0, reps: 8, rir: 2 }]);

  const h = [perf(set(60, 10, 2), set(60, 9, 1), set(60, 8, 0))];
  assert.deepEqual(prefillSets(RDL, rdlItem, h, suggest(RDL, rdlItem, h)),
    [{ weight: 60, reps: 10, rir: 2 }, { weight: 60, reps: 9, rir: 1 }, { weight: 60, reps: 8, rir: 0 }]);

  const top = [perf(set(60, 10, 2), set(60, 10, 2), set(60, 10, 1))];
  assert.deepEqual(prefillSets(RDL, rdlItem, top, suggest(RDL, rdlItem, top)).map((s) => [s.weight, s.reps]), [[65, 8], [65, 8], [65, 8]]);

  // More planned sets than last time: the extra set copies the last one.
  assert.equal(prefillSets(RDL, { ...rdlItem, sets: 4 }, h, suggest(RDL, rdlItem, h)).length, 4);
  // Ramp weeks: at least 3 reps in reserve pre-filled.
  assert.deepEqual(prefillSets(RDL, rdlItem, h, suggest(RDL, rdlItem, h, { ramp: true }), { ramp: true }).map((s) => s.rir), [3, 3, 3]);
  // Timed exercise starts at its target.
  assert.equal(prefillSets(EXERCISES.plank, { sets: 3, repMin: 45, repMax: 45 }, [], { action: 'first', weight: null })[0].reps, 45);
});

// ---------- Records ----------

test('Epley estimated 1RM', () => {
  assert.equal(epley(100, 1), 100);
  assert.equal(epley(100, 10), 100 * (1 + 10 / 30));
  assert.equal(Number(epley(60, 5).toFixed(1)), 70);
  assert.equal(epley(0, 10), 0);
  assert.equal(epley(100, 0), 0);
  assert.equal(epley(40, 15), 0, 'not estimated above 12 reps');
});

test('records: first session is a baseline; later sessions report 1RM and reps-at-weight records', () => {
  assert.deepEqual(exercisePRs('rdl', [set(60, 10)], []), []);
  const history = [perf(set(60, 10), set(60, 9))];
  const prs = exercisePRs('rdl', [set(60, 11), set(65, 8)], history);
  assert.deepEqual(prs.map((p) => p.kind), ['e1rm', 'reps']);
  assert.match(prs[0].text, /Estimated 1RM: 82\.3 kg \(was 80 kg\)/);
  assert.match(prs[1].text, /11 reps at 60 kg \(was 10\)/);
  assert.deepEqual(exercisePRs('rdl', [set(60, 10), set(60, 8)], history), [], 'matching a best is not a record');
  assert.deepEqual(exercisePRs('rdl', [set(50, 12)], history), [], 'a new, lighter weight is not a record');
});

test('records: bodyweight reps, band reps and timed holds', () => {
  const chin = exercisePRs('chinup', [set(0, 8)], [perf(set(0, 6))]);
  assert.match(chin[0].text, /8 reps at bodyweight \(was 6\)/);
  assert.match(exercisePRs('facepull', [set(0, 18)], [perf(set(0, 15))])[0].text, /^18 reps \(was 15\)$/);
  assert.match(exercisePRs('plank', [set(0, 60)], [perf(set(0, 45))])[0].text, /Longest hold: 60 s \(was 45 s\)/);
  assert.deepEqual(exercisePRs('plank', [set(0, 45)], [perf(set(0, 45))]), []);
});

// ---------- Sessions ----------

test('buildSession: next workout pre-filled from history', () => {
  const program = defaultProgram();
  const earlier = [lift(2, 'lowerA', { rdl: [set(60, 10), set(60, 10), set(60, 10)], plank: [set(0, 45), set(0, 40), set(0, 30)] })];
  const s = buildSession(program, 'lowerA', earlier, { now: day(9) });
  assert.equal(s.name, 'Lower A');
  assert.equal(s.date, ymdOf(9));
  assert.equal(s.finishedAt, null);
  assert.deepEqual(s.exercises.map((e) => e.exId), ['rdl', 'bss', 'goblet', 'plank']);
  assert.deepEqual(s.exercises[0].sets.map((x) => [x.weight, x.reps, x.done]), [[65, 8, false], [65, 8, false], [65, 8, false]]);
  assert.deepEqual(s.exercises[3].sets.map((x) => x.reps), [45, 40, 30]);
  assert.equal(s.exercises[1].sets.length, 3);
  // In ramp weeks the weight is held.
  const r = buildSession(program, 'lowerA', earlier, { now: day(9), ramp: true });
  assert.deepEqual(r.exercises[0].sets.map((x) => [x.weight, x.reps, x.rir]), [[60, 10, 3], [60, 10, 3], [60, 10, 3]]);
});

test('volume doubles for two dumbbells and for per-side reps, ignores timed holds and undone sets', () => {
  const s = { exercises: [
    { exId: 'rdl', sets: [set(60, 10), { weight: 60, reps: 10, rir: 2, done: false }] }, // 600
    { exId: 'dbbench', sets: [set(20, 10)] },                                              // two dumbbells: 400
    { exId: 'bss', sets: [set(10, 8)] },                                                   // two dumbbells, each leg: 320
    { exId: 'dbrow', sets: [set(30, 10)] },                                                // each arm: 600
    { exId: 'plank', sets: [set(0, 45)] },
    { exId: 'chinup', sets: [set(0, 8)] },
  ] };
  assert.equal(sessionVolume(s), 600 + 400 + 320 + 600);
});

test('finishSession drops undone sets and empty exercises, computes duration, volume and records', () => {
  const earlier = [lift(2, 'lowerA', { rdl: [set(60, 10), set(60, 9), set(60, 8)] })];
  const active = buildSession(defaultProgram(), 'lowerA', earlier, { now: day(9) });
  active.id = 'active';
  const rdl = active.exercises[0];
  rdl.sets[0] = { ...rdl.sets[0], reps: 11, done: true };
  rdl.sets[1] = { ...rdl.sets[1], done: true };
  const done = finishSession(active, [...earlier, active], day(9) + 50 * 60000);
  assert.equal(done.finishedAt, day(9) + 50 * 60000);
  assert.equal(done.durationSec, 3000);
  assert.deepEqual(done.exercises.map((e) => e.exId), ['rdl']);
  assert.equal(done.exercises[0].sets.length, 2);
  assert.equal(done.volume, 60 * 11 + 60 * 9);
  assert.deepEqual(done.prs.map((p) => p.kind), ['e1rm', 'reps']);
  assert.equal(active.finishedAt, null, 'the original is not mutated');
});

// ---------- Formatting ----------

test('formatting helpers', () => {
  assert.equal(fmtKg(60), '60');
  assert.equal(fmtKg(62.5), '62.5');
  assert.equal(fmtKg(93.3333), '93.3');
  assert.equal(fmtClock(125), '2:05');
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtDuration(3120), '52 min');
  assert.equal(fmtDuration(3900), '1 h 05 min');
  assert.equal(fmtInt(4820), '4,820');
  assert.equal(setsLabel('rdl', [set(60, 10), set(60, 9)]), '60 kg × 10, 9');
  assert.equal(setsLabel('rdl', [set(60, 10), set(62.5, 8)]), '60×10, 62.5×8');
  assert.equal(setsLabel('chinup', [set(0, 6), set(0, 5)]), 'BW × 6, 5');
  assert.equal(setsLabel('facepull', [set(0, 15)]), '15 reps');
  assert.equal(setsLabel('plank', [set(0, 45), set(0, 40)]), '45, 40 s');
});
