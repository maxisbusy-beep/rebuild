// Pure backup logic: build, validate, merge. No browser APIs, so it is unit-tested in Node.
import { ymd, daysBetween, agoLabel } from './dates.js';

export const APP_ID = 'rebuild';
export const SCHEMA = 1;
export const NUDGE_DAYS = 14;

/** Stores included in a backup. Every record is { id: string, updatedAt: number, ... }. */
export const STORES = ['kv', 'sessions', 'bike', 'daily', 'body', 'photos'];

export const STORE_LABELS = {
  kv: 'settings',
  sessions: 'workouts',
  bike: 'bike sessions',
  daily: 'daily check-ins',
  body: 'body check-ins',
  photos: 'photos',
};

export function emptySnapshot() {
  return Object.fromEntries(STORES.map((s) => [s, []]));
}

/** Wrap a snapshot ({store: records[]}) in the backup file envelope. */
export function buildBackup(snapshot, now = Date.now()) {
  const data = emptySnapshot();
  for (const s of STORES) data[s] = (snapshot[s] || []).map((r) => ({ ...r }));
  return { app: APP_ID, schema: SCHEMA, exportedAt: new Date(now).toISOString(), data };
}

export function backupFilename(now = Date.now()) {
  return `rebuild-backup-${ymd(new Date(now))}.json`;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Check a parsed backup file. Returns { ok, errors, counts, exportedAt }.
 * Nothing is written anywhere unless ok is true.
 */
export function validateBackup(obj) {
  const errors = [];
  const counts = Object.fromEntries(STORES.map((s) => [s, 0]));
  if (!isObj(obj)) return { ok: false, errors: ['This is not a Rebuild backup file.'], counts, exportedAt: null };
  if (obj.app !== APP_ID) errors.push('This file was not made by Rebuild.');
  if (!Number.isInteger(obj.schema) || obj.schema < 1) {
    errors.push('The backup has no valid version number.');
  } else if (obj.schema > SCHEMA) {
    errors.push('This backup was made by a newer version of Rebuild. Update the app, then try again.');
  }
  const exportedAt = typeof obj.exportedAt === 'string' && !Number.isNaN(Date.parse(obj.exportedAt)) ? obj.exportedAt : null;
  if (!exportedAt) errors.push('The backup has no valid export date.');
  if (!isObj(obj.data)) {
    errors.push('The backup contains no data section.');
    return { ok: false, errors, counts, exportedAt };
  }
  for (const s of STORES) {
    const list = obj.data[s];
    if (list === undefined) continue; // older backups may lack newer stores
    if (!Array.isArray(list)) { errors.push(`"${s}" is damaged (not a list).`); continue; }
    const seen = new Set();
    let bad = 0, dup = 0;
    for (const r of list) {
      if (!isObj(r) || typeof r.id !== 'string' || r.id === ''
        || (r.updatedAt !== undefined && !Number.isFinite(r.updatedAt))) { bad++; continue; }
      if (seen.has(r.id)) dup++;
      seen.add(r.id);
    }
    if (bad) errors.push(`"${s}" has ${bad} damaged record${bad === 1 ? '' : 's'}.`);
    if (dup) errors.push(`"${s}" has ${dup} duplicated record${dup === 1 ? '' : 's'}.`);
    counts[s] = list.length;
  }
  return { ok: errors.length === 0, errors, counts, exportedAt };
}

/** Parse backup file text. Returns validateBackup's result plus `backup` when ok. */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['This file is not readable (not valid JSON).'], counts: {}, exportedAt: null };
  }
  const res = validateBackup(obj);
  return res.ok ? { ...res, backup: obj } : res;
}

/** Snapshot that results from replacing everything with the backup. */
export function replaceSnapshot(backup) {
  const out = emptySnapshot();
  for (const s of STORES) out[s] = (backup.data[s] || []).map((r) => ({ ...r }));
  return out;
}

/**
 * Snapshot that results from merging the backup into what is on the phone.
 * Records are matched by id. If both sides have one, the more recently edited
 * (updatedAt) wins; on a tie the phone's copy is kept.
 */
export function mergeSnapshots(current, backup) {
  const out = emptySnapshot();
  const stats = { added: 0, updated: 0, kept: 0 };
  for (const s of STORES) {
    const map = new Map((current[s] || []).map((r) => [r.id, r]));
    for (const r of backup.data[s] || []) {
      const mine = map.get(r.id);
      if (!mine) { map.set(r.id, { ...r }); stats.added++; }
      else if ((r.updatedAt || 0) > (mine.updatedAt || 0)) { map.set(r.id, { ...r }); stats.updated++; }
      else stats.kept++;
    }
    out[s] = [...map.values()];
  }
  return { snapshot: out, stats };
}

/** Human summary of what a backup holds, e.g. '12 workouts, 5 bike sessions'. */
export function describeCounts(counts) {
  const parts = STORES.filter((s) => s !== 'kv' && counts[s] > 0)
    .map((s) => `${counts[s]} ${counts[s] === 1 ? STORE_LABELS[s].replace(/s$/, '') : STORE_LABELS[s]}`);
  return parts.length ? parts.join(', ') : 'settings only, no logged data';
}

/**
 * Backup freshness for the home screen.
 * Nudges once the last backup (or, if never backed up, first use) is 14+ days old.
 */
export function backupStatus(lastBackupAt, firstUseAt, now = Date.now()) {
  if (lastBackupAt) {
    const days = Math.max(0, daysBetween(lastBackupAt, now));
    return { never: false, days, label: agoLabel(days), nudge: days >= NUDGE_DAYS };
  }
  const days = firstUseAt ? Math.max(0, daysBetween(firstUseAt, now)) : 0;
  return { never: true, days, label: 'never', nudge: days >= NUDGE_DAYS };
}
