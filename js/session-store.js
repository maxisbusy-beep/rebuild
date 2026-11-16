// Storage-backed workout operations (thin layer over the pure logic in session.js).
import * as db from './db.js';
import { loadProgram } from './program.js';
import { buildSession, finishSession } from './session.js';
import { rampActive } from './rotation.js';
import { ymd } from './dates.js';
import { loadDeload, deloadStatus } from './deload.js';

/** The workout in progress, if any. */
export async function activeSession() {
  return (await db.getAll('sessions')).find((s) => s.type === 'lift' && !s.finishedAt) || null;
}

/** Start the given workout (or return the one already in progress). */
export async function startWorkout(key) {
  const existing = await activeSession();
  if (existing) return existing;
  const [program, sessions, deloadState] = await Promise.all([loadProgram(), db.getAll('sessions'), loadDeload()]);
  const now = Date.now();
  const deload = deloadStatus(sessions, deloadState, new Date(now)).active;
  return db.put('sessions', buildSession(program, key, sessions, { ramp: rampActive(sessions, new Date(now)), deload, now }));
}

/** Finish the workout: compute summary numbers and save. */
export async function finishWorkout(session) {
  const sessions = await db.getAll('sessions');
  return db.put('sessions', finishSession(session, sessions, Date.now()));
}

const restId = (date) => `rest-${date}`;

export async function restLoggedToday() {
  return !!(await db.get('sessions', restId(ymd())));
}

export async function setRestDay(on) {
  const date = ymd();
  if (on) await db.put('sessions', { id: restId(date), type: 'rest', date, finishedAt: Date.now() });
  else await db.del('sessions', restId(date));
}
