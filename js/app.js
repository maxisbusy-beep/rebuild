// App boot: database, service worker, tab bar and hash router.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';
import * as today from './views/today.js';
import * as log from './views/log.js';
import * as progress from './views/progress.js';
import * as body from './views/body.js';
import * as settings from './views/settings.js';

const TABS = [
  { id: 'today', label: 'Today', view: today },
  { id: 'log', label: 'Log', view: log },
  { id: 'progress', label: 'Progress', view: progress },
  { id: 'body', label: 'Body', view: body },
  { id: 'settings', label: 'Settings', view: settings },
];

const viewEl = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
let renderToken = 0;

function currentTab() {
  const id = location.hash.replace(/^#\/?/, '').split('/')[0];
  return TABS.find((t) => t.id === id) || TABS[0];
}

function buildTabs() {
  tabsEl.replaceChildren(...TABS.map((t) =>
    h('a', { class: 'tab', href: `#${t.id}`, 'data-tab': t.id },
      icon(t.id, 'tab-icon'),
      h('span', { class: 'tab-label' }, t.label))));
}

/** Render the tab named in the URL. Exposed so views can ask for a refresh. */
export async function render() {
  const tab = currentTab();
  const token = ++renderToken;
  for (const a of tabsEl.children) {
    const on = a.dataset.tab === tab.id;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const page = h('div', { class: 'page' });
  try {
    await tab.view.render(page, { refresh: render });
  } catch (err) {
    console.error(err);
    page.replaceChildren(h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Something went wrong'),
      h('p', { class: 'dim' }, 'Close and reopen the app. Your data is safe.')));
  }
  if (token !== renderToken) return; // a newer navigation won
  const sameTab = viewEl.dataset.tab === tab.id;
  const scroll = sameTab ? viewEl.scrollTop : 0;
  if (!sameTab) page.classList.add('enter');
  viewEl.dataset.tab = tab.id;
  viewEl.replaceChildren(page);
  viewEl.scrollTop = scroll;
  document.title = tab.id === 'today' ? 'Rebuild' : `${tab.label} · Rebuild`;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
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
  // Refresh when the app comes back to the foreground (new day, new week).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !document.querySelector('.sheet-wrap')
      && !(document.activeElement && document.activeElement.tagName === 'INPUT')) render();
  });
  await render();
  registerServiceWorker();
}

boot();
