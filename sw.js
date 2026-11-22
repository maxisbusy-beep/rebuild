// Service worker: precaches every app file so Rebuild works fully offline.
// VERSION must match js/version.js. Bump both on every release so phones
// pick up the new files (a test checks they agree).
const VERSION = '1.4.1';
const CACHE = `rebuild-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/anim.js',
  'js/anim-ui.js',
  'js/app.js',
  'js/backup.js',
  'js/backup-ui.js',
  'js/bike.js',
  'js/body.js',
  'js/chart.js',
  'js/daily.js',
  'js/dates.js',
  'js/db.js',
  'js/deload.js',
  'js/exercises.js',
  'js/fields.js',
  'js/format.js',
  'js/program.js',
  'js/progression.js',
  'js/records.js',
  'js/rotation.js',
  'js/session.js',
  'js/session-store.js',
  'js/settings.js',
  'js/stats.js',
  'js/ui.js',
  'js/version.js',
  'js/week.js',
  'js/views/today.js',
  'js/views/log.js',
  'js/views/progress.js',
  'js/views/body.js',
  'js/views/settings.js',
  'js/views/program.js',
  'js/views/workout.js',
  'js/views/summary.js',
  'js/views/bike.js',
  'js/views/checkins.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' bypasses the browser HTTP cache so we never precache stale files.
    await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('rebuild-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      const shell = req.mode === 'navigate' ? await cache.match('index.html') : null;
      return shell || Response.error();
    }
  })());
});
