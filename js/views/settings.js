// Settings: profile numbers, rest timers, backup, app info.
import * as db from '../db.js';
import { loadSettings, saveSettings, maxHr, easyZone } from '../settings.js';
import { backupStatus } from '../backup.js';
import { exportBackup, importBackup } from '../backup-ui.js';
import { APP_VERSION } from '../version.js';
import { loadDeload, saveDeload, deloadStatus, startDeload, endDeload, DELOAD_EVERY } from '../deload.js';
import { rampActive } from '../rotation.js';
import { h, icon, card, pageHeader, stepper, toast } from '../ui.js';

export async function render(root, { refresh }) {
  const [settings, lastBackupAt, firstUseAt, persisted, sessions, deloadState] = await Promise.all([
    loadSettings(), db.getMeta('lastBackupAt'), db.getMeta('firstUseAt'), db.isPersisted(), db.getAll('sessions'), loadDeload(),
  ]);
  const now = new Date();
  const deload = deloadStatus(sessions, deloadState, now);
  const setDeload = async (next) => { await saveDeload(next); refresh(); };
  const backup = backupStatus(lastBackupAt, firstUseAt);
  const save = async (patch) => { await saveSettings(patch); refresh(); };
  const zone = easyZone(settings);

  root.append(
    pageHeader('Settings'),

    card('Profile',
      stepper({ label: 'Age', value: settings.age, min: 16, max: 99, unit: 'yr', onChange: (v) => save({ age: v }) }),
      stepper({ label: 'Height', value: settings.heightCm, min: 120, max: 230, unit: 'cm', onChange: (v) => save({ heightCm: v }) }),
      stepper({
        label: 'Max HR',
        hint: settings.maxHr ? 'Set by you' : 'Estimated: 220 minus age',
        value: maxHr(settings), min: 100, max: 220, unit: 'bpm', onChange: (v) => save({ maxHr: v }),
      }),
      settings.maxHr ? h('button', { class: 'btn ghost small', onclick: () => save({ maxHr: null }) }, 'Use 220 minus age') : null,
      h('p', { class: 'note' }, `Easy cardio zone: ${zone.low}–${zone.high} bpm (60–70% of max).`),
      stepper({ label: 'Protein', value: settings.proteinTarget, step: 5, min: 50, max: 400, unit: 'g', onChange: (v) => save({ proteinTarget: v }) })),

    card('Rest timers',
      stepper({ label: 'Compounds', value: settings.restCompound, step: 15, min: 30, max: 600, unit: 's', onChange: (v) => save({ restCompound: v }) }),
      stepper({ label: 'Accessories', value: settings.restAccessory, step: 15, min: 15, max: 600, unit: 's', onChange: (v) => save({ restAccessory: v }) })),

    card('Training cycle',
      h('div', { class: 'row' },
        h('div', { class: 'row-text' },
          h('div', { class: 'row-label' }, deload.active ? 'Deload week' : (deload.weekNumber ? `Week ${deload.weekNumber} of ${DELOAD_EVERY}` : 'Not started')),
          h('div', { class: 'row-hint' }, deload.active ? 'About 60% volume this week'
            : (rampActive(sessions, now) ? 'Ramp weeks: weight increases are held back' : `A deload is suggested in week ${DELOAD_EVERY}`))),
        deload.active
          ? h('button', { class: 'btn small fit', onclick: () => setDeload(endDeload(deloadState, now)) }, 'End deload')
          : h('button', { class: 'btn small fit', onclick: () => setDeload(startDeload(deloadState, now)) }, 'Deload now')),
      h('p', { class: 'note' }, 'A deload week keeps the weights the same and cuts sets to about 60%. It does not count against your progression.')),

    card('Program',
      h('p', { class: 'note' }, 'Four workouts in rotation: Lower A, Upper A, Lower B, Upper B.'),
      h('a', { class: 'btn', href: '#program' }, 'Edit program')),

    card('Backup',
      h('p', { class: `note ${backup.nudge ? 'amber' : ''}`.trim() },
        'Last backup: ', h('strong', {}, backup.label), '. Your data is stored only on this phone, so export a backup regularly and keep the file somewhere safe (Google Drive or email it to yourself).'),
      h('div', { class: 'btn-col' },
        h('button', { class: 'btn primary', onclick: async () => { await exportBackup(); refresh(); } }, icon('download'), 'Export backup'),
        h('button', { class: 'btn', onclick: async () => { if (await importBackup()) refresh(); } }, icon('upload'), 'Import backup'))),

    card('App',
      h('div', { class: 'row' }, h('div', { class: 'row-label' }, 'Version'), h('div', { class: 'row-value' }, APP_VERSION)),
      h('div', { class: 'row' },
        h('div', { class: 'row-text' },
          h('div', { class: 'row-label' }, 'Storage'),
          h('div', { class: 'row-hint' }, persisted ? 'Protected from automatic clean-up' : 'Install the app to the home screen to protect it')),
        h('div', { class: `row-value ${persisted ? 'good' : ''}`.trim() }, persisted ? 'Protected' : 'Standard')),
      h('button', { class: 'btn ghost', onclick: checkForUpdate }, 'Check for update')),
  );
}

async function checkForUpdate() {
  if (!navigator.onLine) return toast('You are offline. Try again with a connection.');
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return toast('Updates are not available in this browser.');
    await reg.update();
    if (!reg.installing && !reg.waiting) toast('You have the latest version.');
  } catch {
    toast('Could not check for updates.');
  }
}
