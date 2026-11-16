// App boot: database, service worker, tab bar and hash router.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';
import * as today from './views/today.js';
import * as log from './views/log.js';
import * as progress from './views/progress.js';
import * as body from './views/body.js';
import * as settings from './views/settings.js';
import * as program from './views/program.js';
import * as workout from './views/workout.js';
import * as summary from './views/summary.js';
import * as bike from './views/bike.js';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'log', label: 'Log' },
  { id: 'progress', label: 'Progress' },
  { id: 'body', label: 'Body' },
  { id: 'settings', label: 'Settings' },
];

// tab: which tab is highlighted; null hides the tab bar (full-screen flows).
// sticky: holds unsaved form input, so it is not re-rendered when the app returns to the foreground.
const ROUTES = {
  today: { view: today, tab: 'today', title: 'Rebuild' },
  log: { view: log, tab: 'log', title: 'Log' },
  progress: { view: progress, tab: 'progress', title: 'Progress' },
  body: { view: body, tab: 'body', title: 'Body' },
  settings: { view: settings, tab: 'settings', title: 'Settings' },
  program: { view: program, tab: 'settings', title: 'Program' },
  workout: { view: workout, tab: null, title: 'Workout' },
  summary: { view: summary, tab: null, title: 'Summary', sticky: true },
  bike: { view: bike, tab: null, title: 'Bike session', sticky: true },
};

const viewEl = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
let renderToken = 0;
let cleanup = null;

function currentRoute() {
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const known = ROUTES[id] ? id : 'today';
  return { id: known, arg: arg || null, ...ROUTES[known] };
}

function buildTabs() {
  tabsEl.replaceChildren(...TABS.map((t) =>
    h('a', { class: 'tab', href: `#${t.id}`, 'data-tab': t.id },
      icon(t.id, 'tab-icon'),
      h('span', { class: 'tab-label' }, t.label))));
}

/** Render the screen named in the URL. Views call this (as `refresh`) after changing data. */
export async function render() {
  const route = currentRoute();
  const token = ++renderToken;
  const page = h('div', { class: 'page' });
  let nextCleanup = null;
  try {
    nextCleanup = await route.view.render(page, { refresh: render, arg: route.arg });
  } catch (err) {
    console.error(err);
    page.replaceChildren(h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Something went wrong'),
      h('p', { class: 'dim' }, 'Close and reopen the app. Your data is safe.')));
  }
  if (token !== renderToken) { // a newer navigation won
    if (typeof nextCleanup === 'function') nextCleanup();
    return;
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = nextCleanup;

  tabsEl.hidden = !route.tab;
  for (const a of tabsEl.children) {
    const on = a.dataset.tab === route.tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const key = route.arg ? `${route.id}/${route.arg}` : route.id;
  const same = viewEl.dataset.route === key;
  const scroll = same ? viewEl.scrollTop : 0;
  if (!same) page.classList.add('enter');
  viewEl.dataset.route = key;
  viewEl.replaceChildren(page);
  viewEl.scrollTop = scroll;
  document.title = route.id === 'today' ? 'Rebuild' : `${route.title} · Rebuild`;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // On the local preview server, skip the offline cache so edits show up immediately.
  if (['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw=1')) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First install also fires this; only announce genuine updates.
    if (hadController) toast('Rebuild was updated.', { action: 'Reload', onAction: () => location.reload(), duration: 0 });
  });
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch (err) {
    console.warn('Service worker registration failed', err);
  }
}

async function boot() {
  buildTabs();
  try {
    await db.open();
    if (!(await db.getMeta('firstUseAt'))) await db.setMeta('firstUseAt', Date.now());
    db.requestPersistence();
  } catch (err) {
    console.error(err);
    viewEl.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Storage unavailable'),
      h('p', { class: 'dim' }, 'Rebuild cannot open its database. If you are in an Incognito tab, open the app in a normal tab instead.'))));
    return;
  }
  window.addEventListener('hashchange', render);
  // Refresh when the app comes back to the foreground (new day, new week), unless the user is mid-edit.
  document.addEventListener('visibilitychange', () => {
    const editing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (document.visibilityState === 'visible' && !document.querySelector('.sheet-wrap') && !editing && !currentRoute().sticky) render();
  });
  await render();
  registerServiceWorker();
}

boot();
