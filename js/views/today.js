// Today: next workout in the rotation, the week at a glance, backup status.
import * as db from '../db.js';
import { backupStatus } from '../backup.js';
import { weekStats, TARGETS } from '../week.js';
import { weekdayName, prettyDate, agoLabel } from '../dates.js';
import { exportBackup } from '../backup-ui.js';
import { loadProgram, rxLabel } from '../program.js';
import { EXERCISES } from '../exercises.js';
import { nextWorkoutKey, daysSinceLast, gapLevel, weekStreak, rampActive } from '../rotation.js';
import { startWorkout, setRestDay, restLoggedToday } from '../session-store.js';
import { doneSetCount } from '../session.js';
import { loadSettings } from '../settings.js';
import { checkinDue } from '../body.js';
import { checkinCards } from './checkins.js';
import { loadDeload, saveDeload, deloadStatus, startDeload, endDeload, skipDeload, DELOAD_TEXT } from '../deload.js';
import { h, icon, ring, card, pageHeader, pill } from '../ui.js';

export const RAMP_TEXT = 'Ramp weeks: keep 3+ reps in reserve, tendons adapt slower than muscle.';

export async function render(root, { refresh }) {
  const [sessions, bike, lastBackupAt, firstUseAt, program, restToday, settings, bodyEntries] = await Promise.all([
    db.getAll('sessions'), db.getAll('bike'), db.getMeta('lastBackupAt'), db.getMeta('firstUseAt'),
    loadProgram(), restLoggedToday(), loadSettings(), db.getAll('body'),
  ]);
  const checkins = await checkinCards(refresh, settings);
  const deloadState = await loadDeload();
  const now = new Date();
  const week = weekStats(sessions, bike, now);
  const backup = backupStatus(lastBackupAt, firstUseAt, now.getTime());
  const active = sessions.find((s) => s.type === 'lift' && !s.finishedAt);
  const nextKey = nextWorkoutKey(program.order, sessions);
  const next = program.workouts[nextKey];
  const gap = daysSinceLast(sessions, bike, now);
  const level = gapLevel(gap);
  const streak = weekStreak(sessions, now);
  const ramp = rampActive(sessions, now);
  const deload = deloadStatus(sessions, deloadState, now);
  const setDeload = async (next) => { await saveDeload(next); refresh(); };

  const start = async () => { await startWorkout(nextKey); location.hash = '#workout'; };

  const workoutCard = active
    ? h('section', { class: 'card next' },
      h('div', { class: 'kicker' }, 'In progress'),
      h('div', { class: 'next-name' }, active.name),
      h('p', { class: 'dim' }, `${doneSetCount(active)} sets logged so far.`),
      h('a', { class: 'btn primary big', href: '#workout' }, 'Resume workout'))
    : h('section', { class: 'card next' },
      h('div', { class: 'kicker' }, 'Next workout'),
      h('div', { class: 'next-name' }, next.name),
      h('ul', { class: 'rx-list' }, next.items.map((it) =>
        h('li', {}, h('span', { class: 'rx-name' }, EXERCISES[it.exId].name), h('span', { class: 'rx-sets' }, rxLabel(it))))),
      h('button', { class: 'btn primary big', onclick: start }, 'Start'),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn', href: '#bike' }, icon('bike'), 'Bike instead'),
        h('button', {
          class: `btn ${restToday ? 'on' : ''}`.trim(), 'aria-pressed': restToday ? 'true' : 'false',
          onclick: async () => { await setRestDay(!restToday); refresh(); },
        }, icon('moon'), restToday ? 'Rest logged' : 'Rest day')));

  const parts = [
    pageHeader(weekdayName(now), prettyDate(now)),

    backup.nudge ? h('section', { class: 'card warn' },
      h('div', { class: 'warn-head' }, icon('alert'), h('h2', { class: 'card-title' }, 'Time to back up')),
      h('p', { class: 'dim' }, backup.never
        ? 'You have never saved a backup. Your data exists only on this phone.'
        : `Your last backup was ${backup.label}. Your data exists only on this phone.`),
      h('button', { class: 'btn primary', onclick: async () => { await exportBackup(); refresh(); } }, icon('download'), 'Back up now')) : null,

    h('div', { class: 'pills' },
      pill('clock', gap === null ? 'No sessions yet' : `Last session ${agoLabel(gap)}`, level === 'ok' ? '' : level),
      pill('flame', streak === 0 ? 'No week streak yet' : `${streak} week streak`, streak > 0 ? 'good' : ''),
      checkinDue(bodyEntries, now) ? h('a', { class: 'pill due', href: '#body' }, icon('scale'), h('span', {}, 'Weekly check-in due')) : null),

    ramp ? h('div', { class: 'banner' }, RAMP_TEXT) : null,

    deload.active ? h('div', { class: 'banner good with-action' },
      h('span', {}, DELOAD_TEXT),
      active ? null : h('button', { class: 'link', onclick: () => setDeload(endDeload(deloadState, now)) }, 'End deload')) : null,

    deload.due ? h('section', { class: 'card warn' },
      h('div', { class: 'warn-head' }, icon('alert'), h('h2', { class: 'card-title' }, `Week ${deload.weekNumber}: deload suggested`)),
      h('p', { class: 'dim' }, 'You have trained for six weeks or more since your last easy week. A week at about 60% volume lets joints and tendons catch up.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: () => setDeload(startDeload(deloadState, now)) }, 'Start deload'),
        h('button', { class: 'btn', onclick: () => setDeload(skipDeload(deloadState, now)) }, 'Not this week'))) : null,

    workoutCard,

    ...checkins,

    card('This week',
      h('div', { class: 'rings' },
        ring({ value: week.lifts, target: TARGETS.lifts, big: week.lifts, label: 'Lifting', sub: `of ${TARGETS.lifts}` }),
        ring({ value: week.rides, target: TARGETS.ridesMin, big: week.rides, label: 'Bike', sub: `of ${TARGETS.ridesMin}–${TARGETS.ridesMax}` }),
        ring({ value: week.minutes, target: TARGETS.cardioMin, big: week.minutes, label: 'Cardio min', sub: `of ${TARGETS.cardioMin}–${TARGETS.cardioMax}` }))),

    backup.nudge ? null : h('a', { class: 'status-line', href: '#settings' },
      icon('shield'),
      h('span', {}, 'Last backup: ', h('strong', {}, backup.label))),
  ];
  root.append(...parts.filter(Boolean));
}
