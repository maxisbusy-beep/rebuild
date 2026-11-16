// Building and finishing workout sessions. Pure logic (no storage).
import { EXERCISES } from './exercises.js';
import { performances, suggest, prefillSets } from './progression.js';
import { exercisePRs } from './records.js';
import { ymd } from './dates.js';

/** The program-item view of a session exercise. */
export const itemOf = (e) => ({ exId: e.exId, sets: e.planned, repMin: e.repMin, repMax: e.repMax });

/** One exercise entry for a new session, pre-filled from history. */
export function buildExercise(item, sessions, { ramp = false } = {}) {
  const ex = EXERCISES[item.exId];
  const history = performances(sessions, item.exId);
  const suggestion = suggest(ex, item, history, { ramp });
  return {
    exId: item.exId,
    name: ex.name,
    planned: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    flag: null, // shoulder flag: null (not answered) | 'none' | 'pop' | 'pain'
    sets: prefillSets(ex, item, history, suggestion, { ramp }).map((s) => ({ ...s, done: false, at: null })),
  };
}

/** A new, unfinished session for the given workout. */
export function buildSession(program, key, sessions, { ramp = false, now = Date.now() } = {}) {
  const w = program.workouts[key];
  return {
    type: 'lift',
    workoutKey: key,
    name: w.name,
    date: ymd(new Date(now)),
    startedAt: now,
    finishedAt: null,
    exercises: w.items.map((it) => buildExercise(it, sessions, { ramp })),
    feel: null,
    note: '',
  };
}

/** Total volume in kg: weight x reps, doubled for two dumbbells and for per-side reps. Timed holds excluded. */
export function sessionVolume(session) {
  let total = 0;
  for (const e of session.exercises) {
    const ex = EXERCISES[e.exId];
    if (!ex || ex.mode === 'time') continue;
    const mult = (ex.pair ? 2 : 1) * (ex.side ? 2 : 1);
    for (const s of e.sets) if (s.done) total += (Number(s.weight) || 0) * (Number(s.reps) || 0) * mult;
  }
  return Math.round(total);
}

export const doneSetCount = (session) => session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
export const openSetCount = (session) => session.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);

/**
 * Close a session: drop sets that were not done (and exercises with none), then
 * compute duration, volume and personal records against all earlier sessions.
 */
export function finishSession(session, sessions, now = Date.now()) {
  const prior = sessions.filter((s) => s.id !== session.id);
  const exercises = session.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
    .filter((e) => e.sets.length);
  const done = { ...session, exercises, finishedAt: now };
  done.durationSec = Math.max(0, Math.round((now - session.startedAt) / 1000));
  done.volume = sessionVolume(done);
  done.prs = exercises.flatMap((e) => exercisePRs(e.exId, e.sets, performances(prior, e.exId)));
  return done;
}
