// Today: the week at a glance and backup status. Workout, bike and check-in cards arrive in later phases.
import * as db from '../db.js';
import { backupStatus } from '../backup.js';
import { weekStats, TARGETS } from '../week.js';
import { weekdayName, prettyDate } from '../dates.js';
import { exportBackup } from '../backup-ui.js';
import { h, icon, ring, card, pageHeader } from '../ui.js';

export async function render(root, { refresh }) {
  const [sessions, bike, lastBackupAt, firstUseAt] = await Promise.all([
    db.getAll('sessions'), db.getAll('bike'), db.getMeta('lastBackupAt'), db.getMeta('firstUseAt'),
  ]);
  const now = new Date();
  const week = weekStats(sessions, bike, now);
  const backup = backupStatus(lastBackupAt, firstUseAt, now.getTime());

  const parts = [
    pageHeader(weekdayName(now), prettyDate(now)),

    backup.nudge ? h('section', { class: 'card warn' },
      h('div', { class: 'warn-head' }, icon('alert'), h('h2', { class: 'card-title' }, 'Time to back up')),
      h('p', { class: 'dim' }, backup.never
        ? 'You have never saved a backup. Your data exists only on this phone.'
        : `Your last backup was ${backup.label}. Your data exists only on this phone.`),
      h('button', { class: 'btn primary', onclick: async () => { await exportBackup(); refresh(); } }, icon('download'), 'Back up now')) : null,

    card('This week',
      h('div', { class: 'rings' },
        ring({ value: week.lifts, target: TARGETS.lifts, big: week.lifts, label: 'Lifting', sub: `of ${TARGETS.lifts}` }),
        ring({ value: week.rides, target: TARGETS.ridesMin, big: week.rides, label: 'Bike', sub: `of ${TARGETS.ridesMin}–${TARGETS.ridesMax}` }),
        ring({ value: week.minutes, target: TARGETS.cardioMin, big: week.minutes, label: 'Cardio min', sub: `of ${TARGETS.cardioMin}–${TARGETS.cardioMax}` }))),

    h('section', { class: 'card next' },
      h('div', { class: 'kicker' }, 'Next workout'),
      h('div', { class: 'next-name' }, 'Lower A'),
      h('p', { class: 'dim' }, 'Workout logging is the next thing being built. This card will carry the Start button.')),

    backup.nudge ? null : h('a', { class: 'status-line', href: '#settings' },
      icon('shield'),
      h('span', {}, 'Last backup: ', h('strong', {}, backup.label))),
  ];
  root.append(...parts.filter(Boolean));
}
