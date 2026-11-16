// IndexedDB wrapper. All data lives on this device only.
import { STORES, emptySnapshot } from './backup.js';

const DB_NAME = 'rebuild';
const DB_VERSION = 1;
const META = 'meta'; // device-local facts (last backup time etc.), never exported
const ALL = [...STORES, META];

let dbPromise;

export function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ALL) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Database is open in another tab.'));
    });
  }
  return dbPromise;
}

/** Run fn inside one transaction; resolves with fn's return value once the transaction commits. */
async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    out = fn(t);
  });
}

export function newId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rand}`;
}

export const get = (store, id) => run([store], 'readonly', (t) => t.objectStore(store).get(id)).then((r) => r.result);

export const getAll = (store) => run([store], 'readonly', (t) => t.objectStore(store).getAll()).then((r) => r.result);

/** Save a record. Stamps updatedAt (used when merging backups) and assigns an id if missing. */
export async function put(store, record) {
  const rec = { ...record, id: record.id || newId(), updatedAt: Date.now() };
  await run([store], 'readwrite', (t) => t.objectStore(store).put(rec));
  return rec;
}

export const del = (store, id) => run([store], 'readwrite', (t) => t.objectStore(store).delete(id));

// Key-value helpers (settings, program, saved foods live in the 'kv' store).
export async function getKV(key, fallback = null) {
  const rec = await get('kv', key);
  return rec ? rec.value : fallback;
}
export const setKV = (key, value) => put('kv', { id: key, value });

export async function getMeta(key, fallback = null) {
  const rec = await get(META, key);
  return rec ? rec.value : fallback;
}
export const setMeta = (key, value) => run([META], 'readwrite', (t) => t.objectStore(META).put({ id: key, value }));

/** Everything that goes into a backup: { store: records[] }. */
export async function snapshot() {
  const reqs = await run(STORES, 'readonly', (t) => Object.fromEntries(STORES.map((s) => [s, t.objectStore(s).getAll()])));
  const out = emptySnapshot();
  for (const s of STORES) out[s] = reqs[s].result;
  return out;
}

/** Replace all backed-up data with the snapshot, atomically (all or nothing). */
export function applySnapshot(snap) {
  return run(STORES, 'readwrite', (t) => {
    for (const s of STORES) {
      const os = t.objectStore(s);
      os.clear();
      for (const rec of snap[s] || []) os.put(rec);
    }
  });
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isPersisted() {
  try {
    return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted());
  } catch {
    return false;
  }
}
