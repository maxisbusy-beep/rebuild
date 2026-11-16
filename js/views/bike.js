// Bike session form: stopwatch or after-the-fact entry. #bike = new, #bike/<id> = edit.
import * as db from '../db.js';
import { loadSettings, easyZone, maxHr } from '../settings.js';
import { cleanRide, avgSpeed, watch, watchMinutes, WATCH_ZERO } from '../bike.js';
import { ymd } from '../dates.js';
import { fmtClock } from '../format.js';
import { h, icon, sheet, toast, card, segmented } from '../ui.js';
import { numField, dateField } from '../fields.js';

export async function render(root, { arg }) {
  const [existing, settings, rides] = await Promise.all([arg ? db.get('bike', arg) : null, loadSettings(), db.getAll('bike')]);
  if (arg && !existing) { location.replace('#log/bike'); return null; }

  const lastRide = rides.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const draft = existing ? { ...existing } : {
    date: ymd(), duration: null, distance: null,
    resistance: lastRide && lastRide.resistance !== null ? lastRide.resistance : null,
    avgHr: null, calories: null, feel: null, note: '',
  };
  const zone = easyZone(settings);
  const back = existing ? '#log/bike' : '#today';

  // ----- Fields -----
  const speed = h('p', { class: 'note' });
  const paintSpeed = () => {
    const v = avgSpeed({ distance: Number(draft.distance), duration: Number(draft.duration) });
    speed.textContent = v ? `Average speed: ${v.toFixed(1)} km/h` : 'Average speed appears once duration and distance are filled in.';
  };
  const set = (key) => (v) => { draft[key] = v; paintSpeed(); };
  const durationField = numField({ label: 'Duration', hint: 'Required', value: draft.duration, unit: 'min', min: 1, max: 600, step: 1, onChange: set('duration') });
  const note = h('textarea', { class: 'note-input', rows: '2', maxlength: '500', placeholder: 'Optional note' });
  note.value = draft.note || '';
  note.addEventListener('input', () => { draft.note = note.value; });
  paintSpeed();

  // ----- Stopwatch (new sessions only) -----
  let w = existing ? null : await db.getMeta('bikeWatch', WATCH_ZERO);
  let timer = null;
  let lock = null;
  const clock = h('div', { class: 'watch-clock' }, '0:00');
  const watchBtns = h('div', { class: 'btn-row' });
  const saveWatch = () => db.setMeta('bikeWatch', w);
  const paintWatch = () => {
    const ms = watch.elapsed(w, Date.now());
    clock.textContent = fmtClock(ms / 1000);
    clock.classList.toggle('running', !!w.running);
    watchBtns.replaceChildren(...[
      w.running
        ? h('button', { class: 'btn primary', onclick: pause }, 'Pause')
        : h('button', { class: 'btn primary', onclick: start }, ms > 0 ? 'Resume' : 'Start'),
      !w.running && ms > 0 ? h('button', { class: 'btn', onclick: reset }, 'Reset') : null,
    ].filter(Boolean));
  };
  const useTime = () => {
    draft.duration = watchMinutes(watch.elapsed(w, Date.now()));
    durationField.setValue(draft.duration);
    paintSpeed();
  };
  async function holdLock() {
    try { if ('wakeLock' in navigator && (!lock || lock.released)) lock = await navigator.wakeLock.request('screen'); } catch { /* optional */ }
  }
  function dropLock() { if (lock) { lock.release().catch(() => {}); lock = null; } }
  async function start() { w = watch.start(w, Date.now()); await saveWatch(); holdLock(); paintWatch(); }
  async function pause() { w = watch.pause(w, Date.now()); await saveWatch(); dropLock(); useTime(); paintWatch(); }
  async function reset() { w = watch.reset(); await saveWatch(); paintWatch(); }

  if (w) {
    paintWatch();
    if (w.running) holdLock();
    timer = setInterval(() => { if (w.running) clock.textContent = fmtClock(watch.elapsed(w, Date.now()) / 1000); }, 500);
  }

  async function save() {
    if (w && w.running) await pause();
    if (w && !draft.duration && watch.elapsed(w, Date.now()) > 0) useTime();
    const res = cleanRide(draft);
    if (!res.ok) return toast(res.errors[0], { tone: 'bad', duration: 5000 });
    await db.put('bike', res.ride);
    if (w) await db.setMeta('bikeWatch', watch.reset());
    toast(existing ? 'Bike session updated.' : 'Bike session saved.');
    location.hash = '#log/bike';
  }

  async function remove() {
    const ok = await sheet({
      title: 'Delete this bike session?',
      body: h('p', { class: 'sheet-text' }, 'It will be removed from your history and weekly totals. This cannot be undone.'),
      actions: [{ label: 'Delete', value: true, kind: 'danger' }, { label: 'Cancel', value: false }],
    });
    if (!ok) return;
    await db.del('bike', existing.id);
    toast('Bike session deleted.');
    location.hash = '#log/bike';
  }

  root.classList.add('workout', 'form');
  root.append(...[
    h('header', { class: 'wk-top' },
      h('a', { class: 'icon-btn', href: back, 'aria-label': 'Back' }, icon('back')),
      h('div', { class: 'wk-title' }, h('div', { class: 'wk-name' }, existing ? 'Edit' : 'New'), h('span', { class: 'wk-clock' }, 'Bike session')),
      h('button', { class: 'btn small fit primary', onclick: save }, 'Save')),

    h('div', { class: 'banner good' }, `Easy cardio zone: ${zone.low}–${zone.high} bpm (60–70% of your max ${maxHr(settings)}).`),

    w ? card('Stopwatch', clock, watchBtns,
      h('p', { class: 'note' }, 'Optional. Pausing fills in the duration below. It keeps running if you leave this screen.')) : null,

    card('Session',
      dateField({ label: 'Date', value: draft.date, max: ymd(), onChange: (v) => { draft.date = v; } }),
      durationField,
      numField({ label: 'Distance', value: draft.distance, unit: 'km', min: 0, max: 300, step: 0.1, onChange: set('distance') }),
      numField({ label: 'Resistance', hint: 'Level on the bike', value: draft.resistance, min: 0, max: 100, step: 1, onChange: set('resistance') }),
      numField({ label: 'Average heart rate', value: draft.avgHr, unit: 'bpm', min: 30, max: 230, step: 1, onChange: set('avgHr') }),
      numField({ label: 'Calories', value: draft.calories, unit: 'kcal', min: 0, max: 5000, step: 1, onChange: set('calories') }),
      speed),

    card('How did it feel?',
      segmented({ options: [1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n })), value: draft.feel, label: 'Feel', cls: 'feel', allowNone: true,
        onChange: (v) => { draft.feel = v; } }),
      h('div', { class: 'feel-scale' }, h('span', {}, 'Rough'), h('span', {}, 'Great'))),

    card('Note', note),

    h('button', { class: 'btn primary big', onclick: save }, existing ? 'Save changes' : 'Save bike session'),
    existing ? h('button', { class: 'btn ghost', onclick: remove }, 'Delete this session') : null,
  ].filter(Boolean));

  return () => { if (timer) clearInterval(timer); dropLock(); };
}
