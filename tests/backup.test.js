import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ID, SCHEMA, STORES, buildBackup, backupFilename, validateBackup, parseBackup,
  replaceSnapshot, mergeSnapshots, describeCounts, backupStatus, emptySnapshot,
} from '../js/backup.js';

const DAY = 86400000;
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

function sampleSnapshot() {
  return {
    ...emptySnapshot(),
    kv: [{ id: 'settings', value: { age: 51 }, updatedAt: 100 }],
    sessions: [
      { id: 's1', type: 'lift', date: '2026-11-10', updatedAt: 100 },
      { id: 's2', type: 'lift', date: '2026-11-12', updatedAt: 200 },
    ],
    bike: [{ id: 'b1', date: '2026-11-11', duration: 30, updatedAt: 150 }],
  };
}

test('buildBackup wraps every store in a versioned envelope', () => {
  const b = buildBackup(sampleSnapshot(), at(2026, 11, 16));
  assert.equal(b.app, APP_ID);
  assert.equal(b.schema, SCHEMA);
  assert.equal(b.exportedAt, new Date(at(2026, 11, 16)).toISOString());
  assert.deepEqual(Object.keys(b.data).sort(), [...STORES].sort());
  assert.equal(b.data.sessions.length, 2);
  assert.deepEqual(b.data.photos, []);
});

test('buildBackup copies records so later edits do not change the backup', () => {
  const snap = sampleSnapshot();
  const b = buildBackup(snap);
  snap.sessions[0].date = 'changed';
  assert.equal(b.data.sessions[0].date, '2026-11-10');
});

test('backupFilename is dated in local time', () => {
  assert.equal(backupFilename(at(2026, 11, 6)), 'rebuild-backup-2026-11-06.json');
});

test('export then import (replace) round-trips the data exactly', () => {
  const snap = sampleSnapshot();
  const text = JSON.stringify(buildBackup(snap));
  const res = parseBackup(text);
  assert.equal(res.ok, true);
  assert.deepEqual(replaceSnapshot(res.backup), snap);
  assert.deepEqual(res.counts, { kv: 1, sessions: 2, bike: 1, daily: 0, body: 0, photos: 0 });
});

test('parseBackup rejects text that is not JSON', () => {
  const res = parseBackup('not json {');
  assert.equal(res.ok, false);
  assert.equal(res.backup, undefined);
  assert.match(res.errors[0], /not readable/);
});

test('validateBackup rejects non-objects and files from other apps', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup([]).ok, false);
  assert.equal(validateBackup('x').ok, false);
  const other = { ...buildBackup(sampleSnapshot()), app: 'someone-else' };
  const res = validateBackup(other);
  assert.equal(res.ok, false);
  assert.match(res.errors.join(' '), /not made by Rebuild/);
});

test('validateBackup rejects backups from a newer app version', () => {
  const res = validateBackup({ ...buildBackup(sampleSnapshot()), schema: SCHEMA + 1 });
  assert.equal(res.ok, false);
  assert.match(res.errors.join(' '), /newer version/);
});

test('validateBackup rejects missing schema, export date or data', () => {
  const good = buildBackup(sampleSnapshot());
  assert.equal(validateBackup({ ...good, schema: undefined }).ok, false);
  assert.equal(validateBackup({ ...good, schema: 0 }).ok, false);
  assert.equal(validateBackup({ ...good, exportedAt: 'yesterday-ish' }).ok, false);
  assert.equal(validateBackup({ ...good, data: undefined }).ok, false);
  assert.equal(validateBackup({ ...good, data: [] }).ok, false);
});

test('validateBackup rejects damaged stores and records', () => {
  const mk = (patch) => { const b = buildBackup(sampleSnapshot()); Object.assign(b.data, patch); return validateBackup(b); };
  assert.equal(mk({ sessions: 'oops' }).ok, false);
  assert.equal(mk({ sessions: [{ type: 'lift' }] }).ok, false, 'record without id');
  assert.equal(mk({ sessions: [{ id: 5 }] }).ok, false, 'non-string id');
  assert.equal(mk({ sessions: [{ id: '' }] }).ok, false, 'empty id');
  assert.equal(mk({ sessions: [null] }).ok, false, 'null record');
  assert.equal(mk({ sessions: [{ id: 'a', updatedAt: 'x' }] }).ok, false, 'bad updatedAt');
  assert.equal(mk({ sessions: [{ id: 'a' }, { id: 'a' }] }).ok, false, 'duplicate ids');
});

test('validateBackup accepts a backup that lacks a store (older file) and ignores unknown stores', () => {
  const b = buildBackup(sampleSnapshot());
  delete b.data.photos;
  b.data.futureThing = [{ whatever: true }];
  const res = validateBackup(b);
  assert.equal(res.ok, true);
  assert.equal(res.counts.photos, 0);
  const snap = replaceSnapshot(b);
  assert.deepEqual(snap.photos, []);
  assert.equal(snap.futureThing, undefined);
});

test('merge adds records that exist only in the backup and keeps phone-only records', () => {
  const phone = { ...emptySnapshot(), sessions: [{ id: 'p1', updatedAt: 10 }] };
  const backup = buildBackup({ ...emptySnapshot(), sessions: [{ id: 'b1', updatedAt: 5 }] });
  const { snapshot, stats } = mergeSnapshots(phone, backup);
  assert.deepEqual(snapshot.sessions.map((r) => r.id).sort(), ['b1', 'p1']);
  assert.deepEqual(stats, { added: 1, updated: 0, kept: 0 });
});

test('merge: newer copy wins in both directions, ties keep the phone copy', () => {
  const phone = {
    ...emptySnapshot(),
    sessions: [
      { id: 'a', v: 'phone', updatedAt: 100 },
      { id: 'b', v: 'phone', updatedAt: 300 },
      { id: 'c', v: 'phone', updatedAt: 200 },
    ],
  };
  const backup = buildBackup({
    ...emptySnapshot(),
    sessions: [
      { id: 'a', v: 'backup', updatedAt: 200 },
      { id: 'b', v: 'backup', updatedAt: 200 },
      { id: 'c', v: 'backup', updatedAt: 200 },
    ],
  });
  const { snapshot, stats } = mergeSnapshots(phone, backup);
  const byId = Object.fromEntries(snapshot.sessions.map((r) => [r.id, r.v]));
  assert.deepEqual(byId, { a: 'backup', b: 'phone', c: 'phone' });
  assert.deepEqual(stats, { added: 0, updated: 1, kept: 2 });
});

test('merge does not mutate its inputs and is idempotent', () => {
  const phone = sampleSnapshot();
  const backup = buildBackup(sampleSnapshot());
  const before = JSON.stringify([phone, backup]);
  const once = mergeSnapshots(phone, backup).snapshot;
  const twice = mergeSnapshots(once, backup).snapshot;
  assert.equal(JSON.stringify([phone, backup]), before);
  assert.deepEqual(twice, once);
  assert.deepEqual(once, phone);
});

test('merge into an empty phone equals replace', () => {
  const backup = buildBackup(sampleSnapshot());
  assert.deepEqual(mergeSnapshots(emptySnapshot(), backup).snapshot, replaceSnapshot(backup));
});

test('describeCounts summarises contents in plain words', () => {
  assert.equal(describeCounts({ kv: 1, sessions: 2, bike: 1, daily: 0, body: 0, photos: 0 }), '2 workouts, 1 bike session');
  assert.equal(describeCounts({ kv: 1, sessions: 0, bike: 0, daily: 0, body: 0, photos: 0 }), 'settings only, no logged data');
});

test('backupStatus: labels and 14-day nudge after a backup', () => {
  const now = at(2026, 11, 16);
  assert.deepEqual(backupStatus(now, null, now), { never: false, days: 0, label: 'today', nudge: false });
  assert.equal(backupStatus(now - DAY, null, now).label, 'yesterday');
  assert.equal(backupStatus(at(2026, 11, 3), null, now).label, '13 days ago');
  assert.equal(backupStatus(at(2026, 11, 3), null, now).nudge, false);
  assert.equal(backupStatus(at(2026, 11, 2), null, now).nudge, true);
  assert.equal(backupStatus(at(2026, 11, 2), null, now).days, 14);
});

test('backupStatus counts calendar days, not 24-hour blocks', () => {
  // 23:00 yesterday to 01:00 today is one day ago, though only 2 hours passed.
  const s = backupStatus(at(2026, 11, 15, 23), null, at(2026, 11, 16, 1));
  assert.equal(s.days, 1);
});

test('backupStatus: never backed up nudges only after 14 days of use', () => {
  const now = at(2026, 11, 16);
  assert.deepEqual(backupStatus(null, now, now), { never: true, days: 0, label: 'never', nudge: false });
  assert.equal(backupStatus(null, at(2026, 11, 3), now).nudge, false);
  assert.equal(backupStatus(null, at(2026, 11, 2), now).nudge, true);
  assert.equal(backupStatus(null, null, now).nudge, false);
});
