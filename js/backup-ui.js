// Export / import flows shared by the Today and Settings screens.
import * as db from './db.js';
import { buildBackup, backupFilename, parseBackup, replaceSnapshot, mergeSnapshots, describeCounts } from './backup.js';
import { prettyDate } from './dates.js';
import { h, sheet, toast } from './ui.js';

/** Download a dated JSON backup and record the time. */
export async function exportBackup() {
  const now = Date.now();
  const backup = buildBackup(await db.snapshot(), now);
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: backupFilename(now), style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  await db.setMeta('lastBackupAt', now);
  toast(`Backup saved to Downloads: ${backupFilename(now)}`, { duration: 5000 });
  return true;
}

/** Let the user pick a backup file, validate it, then replace or merge. Resolves true if data changed. */
export function importBackup() {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(false);
      try {
        resolve(await handleFile(file));
      } catch (err) {
        console.error(err);
        toast('Import failed. Nothing was changed.', { tone: 'bad', duration: 6000 });
        resolve(false);
      }
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(false); });
    document.body.append(input);
    input.click();
  });
}

async function handleFile(file) {
  const res = parseBackup(await file.text());
  if (!res.ok) {
    await sheet({
      title: 'This file can’t be imported',
      body: h('div', {},
        h('p', { class: 'sheet-text' }, 'Nothing on this phone was changed.'),
        h('ul', { class: 'sheet-list' }, res.errors.map((e) => h('li', {}, e)))),
      actions: [{ label: 'OK', value: null, kind: 'primary' }],
    });
    return false;
  }

  const choice = await sheet({
    title: 'Import backup',
    body: h('div', {},
      h('p', { class: 'sheet-text' }, `Backup from ${prettyDate(res.exportedAt, { short: true })}: ${describeCounts(res.counts)}.`),
      h('p', { class: 'sheet-text dim' }, 'Merge keeps what is on this phone and adds the backup to it; where both have the same entry, the newer one wins. Replace erases this phone’s data first.')),
    actions: [
      { label: 'Merge with this phone', value: 'merge', kind: 'primary' },
      { label: 'Replace everything', value: 'replace', kind: 'danger' },
      { label: 'Cancel', value: null, kind: 'ghost' },
    ],
  });
  if (!choice) return false;

  if (choice === 'replace') {
    const sure = await sheet({
      title: 'Replace everything?',
      body: h('p', { class: 'sheet-text' }, 'All data on this phone will be erased and replaced by the backup. This cannot be undone.'),
      actions: [
        { label: 'Yes, replace', value: true, kind: 'danger' },
        { label: 'Cancel', value: false, kind: 'ghost' },
      ],
    });
    if (!sure) return false;
    await db.applySnapshot(replaceSnapshot(res.backup));
    toast('Backup restored.');
    return true;
  }

  const { snapshot, stats } = mergeSnapshots(await db.snapshot(), res.backup);
  await db.applySnapshot(snapshot);
  toast(`Merged: ${stats.added} added, ${stats.updated} updated.`, { duration: 5000 });
  return true;
}
