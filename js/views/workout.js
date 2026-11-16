// Workout in progress: set logging, rest timer, swaps, shoulder flags.
import * as db from '../db.js';
import { loadSettings } from '../settings.js';
import { loadProgram } from '../program.js';
import { EXERCISES, weightUnit, weightStep, hasWeight } from '../exercises.js';
import { performances, suggest } from '../progression.js';
import { rampActive } from '../rotation.js';
import { activeSession, finishWorkout } from '../session-store.js';
import { buildExercise, itemOf, openSetCount, doneSetCount } from '../session.js';
import { fmtClock, setLabel, setsLabel } from '../format.js';
import { prettyDate, parseYmd } from '../dates.js';
import { h, icon, sheet, toast, stepper, segmented } from '../ui.js';
import { RAMP_TEXT } from './today.js';
import { DELOAD_TEXT } from '../deload.js';

// Rest timer state lives outside render() so it survives screen refreshes.
let rest = null; // { endsAt, total, firedAt }
let wakeLock = null;

async function holdWakeLock() {
  try {
    if (!('wakeLock' in navigator) || (wakeLock && !wakeLock.released)) return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* not allowed right now (e.g. battery saver); the app still works */ }
}
function dropWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

function startRest(seconds) {
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds, firedAt: null };
}

const FLAGS = [
  { label: 'Fine', value: 'none' },
  { label: 'Pop, no pain', value: 'pop', tone: 'amber' },
  { label: 'Pain', value: 'pain', tone: 'red' },
];

export async function render(root, { refresh }) {
  const [session, settings, sessions, program] = await Promise.all([
    activeSession(), loadSettings(), db.getAll('sessions'), loadProgram(),
  ]);
  if (!session) { location.replace('#today'); return null; }

  const ramp = rampActive(sessions, new Date());
  const save = () => db.put('sessions', session);
  const commit = async () => { await save(); refresh(); };
  holdWakeLock();

  // ----- Top bar -----
  const clock = h('span', { class: 'wk-clock' }, fmtClock((Date.now() - session.startedAt) / 1000));
  const open = openSetCount(session);
  const topbar = h('header', { class: 'wk-top' },
    h('a', { class: 'icon-btn', href: '#today', 'aria-label': 'Back to Today' }, icon('back')),
    h('div', { class: 'wk-title' }, h('div', { class: 'wk-name' }, session.name), clock),
    h('button', { class: `btn small fit ${open === 0 ? 'primary' : ''}`.trim(), onclick: finish }, 'Finish'));

  // ----- Exercises -----
  const cards = session.exercises.map((e, ei) => exerciseCard(e, ei));

  // ----- Rest timer bar -----
  const restTime = h('div', { class: 'rest-time' });
  const restFill = h('div', { class: 'rest-fill' });
  const restBar = h('div', { class: 'rest', hidden: true },
    h('div', { class: 'rest-track' }, restFill),
    h('div', { class: 'rest-row' },
      h('div', {}, h('div', { class: 'rest-label' }, 'Rest'), restTime),
      h('div', { class: 'rest-btns' },
        h('button', { class: 'btn small fit', onclick: () => { if (rest && !rest.firedAt) { rest.endsAt += 30000; rest.total += 30; tick(); } } }, '+30 s'),
        h('button', { class: 'btn small fit', onclick: () => { rest = null; tick(); } }, 'Skip'))));

  function tick() {
    clock.textContent = fmtClock((Date.now() - session.startedAt) / 1000);
    if (!rest) { restBar.hidden = true; return; }
    const now = Date.now();
    const left = Math.ceil((rest.endsAt - now) / 1000);
    if (left <= 0 && !rest.firedAt) {
      rest.firedAt = now;
      if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
    }
    if (rest.firedAt && now - rest.firedAt > 8000) { rest = null; restBar.hidden = true; return; }
    restBar.hidden = false;
    restBar.classList.toggle('go', !!rest.firedAt);
    restTime.textContent = rest.firedAt ? 'Go' : fmtClock(left);
    restFill.style.transform = `scaleX(${rest.firedAt ? 1 : Math.max(0, Math.min(1, 1 - (rest.endsAt - now) / (rest.total * 1000)))})`;
  }
  const timer = setInterval(tick, 250);
  const onVisible = () => { if (document.visibilityState === 'visible') holdWakeLock(); };
  document.addEventListener('visibilitychange', onVisible);
  tick();

  root.classList.add('workout');
  root.append(...[
    topbar,
    session.deload ? h('div', { class: 'banner good' }, DELOAD_TEXT) : (ramp ? h('div', { class: 'banner' }, RAMP_TEXT) : null),
    ...cards,
    h('button', { class: `btn big ${open === 0 ? 'primary' : ''}`.trim(), onclick: finish }, 'Finish workout'),
    h('button', { class: 'btn ghost', onclick: discard }, 'Discard workout'),
    restBar,
  ].filter(Boolean));

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    if (!location.hash.startsWith('#workout')) dropWakeLock();
  };

  // ----- Pieces -----

  function exerciseCard(e, ei) {
    const ex = EXERCISES[e.exId];
    const history = performances(sessions.filter((s) => s.id !== session.id), e.exId);
    const last = history[history.length - 1];
    const tip = session.deload
      ? { action: 'hold', text: 'Deload: same weight as last time, fewer sets, stop 3+ reps short.' }
      : suggest(ex, itemOf(e), history, { ramp });
    const allDone = e.sets.length > 0 && e.sets.every((s) => s.done);

    return h('section', { class: `card ex ${allDone ? 'complete' : ''}`.trim() },
      h('div', { class: 'ex-head' },
        h('div', { class: 'ex-titles' },
          h('h2', { class: 'ex-name' }, ex.name),
          h('div', { class: 'ex-rx' }, rxText(e, ex))),
        h('button', { class: 'icon-btn', 'aria-label': `Swap ${ex.name}`, onclick: () => swap(ei) }, icon('swap'))),
      h('p', { class: 'ex-cue' }, ex.cue),
      h('div', { class: 'ex-last' },
        h('span', { class: 'ex-last-label' }, 'Last'),
        h('span', {}, last ? `${setsLabel(e.exId, last.sets)} · ${prettyDate(parseYmd(last.date), { short: true }).replace(/ \d{4}$/, '')}` : 'No previous session')),
      h('div', { class: `tip ${tip.action}` }, tip.text),
      h('div', { class: 'sets' }, e.sets.map((s, si) => setRow(e, ei, s, si))),
      h('button', { class: 'btn ghost small', onclick: () => addSet(ei) }, icon('plus'), 'Add set'),
      ex.upper ? h('div', { class: 'flag' },
        h('div', { class: 'flag-label' }, 'Right shoulder'),
        segmented({ options: FLAGS, value: e.flag, label: 'Right shoulder', allowNone: true,
          onChange: (v) => { e.flag = v; save(); } })) : null);
  }

  function rxText(e, ex) {
    const what = ex.mode === 'amrap' ? 'AMRAP' : ex.mode === 'time' ? `${e.repMax} s`
      : (e.repMin === e.repMax ? `${e.repMax}` : `${e.repMin}–${e.repMax}`);
    return `${e.planned} × ${what}${ex.side ? ' each side' : ''}${ex.pair ? ' · weight per dumbbell' : ''}`;
  }

  function setRow(e, ei, s, si) {
    const needsWeight = hasWeight(EXERCISES[e.exId]) && EXERCISES[e.exId].equip !== 'bw' && !(s.weight > 0);
    return h('div', { class: `set ${s.done ? 'done' : ''}`.trim() },
      h('button', { class: 'set-main', 'aria-label': `Edit set ${si + 1}`, onclick: () => editSet(ei, si) },
        h('span', { class: 'set-n' }, String(si + 1)),
        h('span', { class: 'set-val' }, needsWeight ? h('span', { class: 'set-ask' }, 'Set weight') : setLabel(e.exId, s)),
        h('span', { class: 'set-rir' }, `RIR ${s.rir}`)),
      h('button', {
        class: 'set-check', 'aria-label': s.done ? `Undo set ${si + 1}` : `Confirm set ${si + 1}`, 'aria-pressed': s.done ? 'true' : 'false',
        onclick: () => (needsWeight && !s.done ? editSet(ei, si) : toggleSet(ei, si)),
      }, icon('check')));
  }

  async function toggleSet(ei, si) {
    const e = session.exercises[ei], s = e.sets[si];
    s.done = !s.done;
    s.at = s.done ? Date.now() : null;
    if (s.done && navigator.vibrate) navigator.vibrate(15);
    if (s.done) startRest(EXERCISES[e.exId].kind === 'compound' ? settings.restCompound : settings.restAccessory);
    await commit();
  }

  async function addSet(ei) {
    const e = session.exercises[ei];
    const prev = e.sets[e.sets.length - 1];
    e.sets.push(prev ? { ...prev, done: false, at: null } : { weight: 0, reps: e.repMin || 5, rir: 2, done: false, at: null });
    await commit();
  }

  async function editSet(ei, si) {
    const e = session.exercises[ei], ex = EXERCISES[e.exId], s = e.sets[si];
    const draft = { weight: s.weight, reps: s.reps, rir: s.rir };
    const body = h('div', { class: 'edit-set' },
      hasWeight(ex) ? stepper({
        label: 'Weight', hint: ex.equip === 'bw' ? '0 = bodyweight only' : (ex.pair ? 'Per dumbbell' : null),
        value: draft.weight, step: weightStep(ex), min: 0, max: 500, unit: 'kg', onChange: (v) => { draft.weight = v; },
      }) : null,
      stepper({
        label: ex.mode === 'time' ? 'Seconds' : 'Reps', hint: ex.side ? 'Each side' : null,
        value: draft.reps, step: ex.mode === 'time' ? 5 : 1, min: 0, max: ex.mode === 'time' ? 900 : 100,
        unit: ex.mode === 'time' ? 's' : '', onChange: (v) => { draft.reps = v; },
      }),
      h('div', { class: 'row col' },
        h('div', { class: 'row-text' }, h('div', { class: 'row-label' }, 'Reps in reserve'), h('div', { class: 'row-hint' }, 'How many more you could have done')),
        segmented({ options: [0, 1, 2, 3, 4].map((n) => ({ label: n === 4 ? '4+' : String(n), value: n })), value: draft.rir, label: 'Reps in reserve',
          onChange: (v) => { draft.rir = v; } })));
    const choice = await sheet({
      title: `${ex.name} · set ${si + 1}`,
      body,
      actions: [
        s.done ? { label: 'Save', value: 'save', kind: 'primary' } : { label: 'Save and confirm set', value: 'done', kind: 'primary' },
        s.done ? { label: 'Mark as not done', value: 'undo' } : { label: 'Save without confirming', value: 'save' },
        { label: 'Apply weight to all remaining sets', value: 'all' },
        e.sets.length > 1 ? { label: 'Remove this set', value: 'remove', kind: 'danger' } : null,
      ].filter(Boolean),
    });
    if (!choice) return;
    if (choice === 'remove') { e.sets.splice(si, 1); return commit(); }
    Object.assign(s, { weight: Math.max(0, draft.weight || 0), reps: Math.max(0, Math.round(draft.reps || 0)), rir: draft.rir });
    if (choice === 'all') for (const other of e.sets) if (!other.done) other.weight = s.weight;
    if (choice === 'undo') { s.done = false; s.at = null; }
    if (choice === 'done') {
      s.done = true; s.at = Date.now();
      // Carry a changed weight forward to the sets still to come.
      for (const later of e.sets.slice(si + 1)) if (!later.done) later.weight = s.weight;
      startRest(ex.kind === 'compound' ? settings.restCompound : settings.restAccessory);
    }
    return commit();
  }

  async function swap(ei) {
    const e = session.exercises[ei], ex = EXERCISES[e.exId];
    if (e.sets.some((s) => s.done)) return toast('Undo this exercise’s confirmed sets before swapping it.');
    // Offer the alternatives, plus the program's own exercise for this slot if it was swapped away.
    const planned = program.workouts[session.workoutKey] && program.workouts[session.workoutKey].items[ei];
    const options = [...new Set([...(planned && planned.exId !== e.exId ? [planned.exId] : []), ...ex.swaps])]
      .filter((id) => !session.exercises.some((x) => x.exId === id));
    const pick = await sheet({
      title: `Swap ${ex.name}`,
      body: h('p', { class: 'sheet-text dim' }, 'For today only. To change it for good, use Settings → Program.'),
      actions: [...options.map((id) => ({ label: EXERCISES[id].name, value: id, kind: 'plain' })), { label: 'Cancel', value: null }],
    });
    if (!pick) return;
    const to = EXERCISES[pick];
    const keep = ex.mode === 'reps' && to.mode === 'reps';
    session.exercises[ei] = buildExercise({
      exId: pick, sets: e.planned,
      repMin: keep ? e.repMin : to.def.repMin, repMax: keep ? e.repMax : to.def.repMax,
    }, sessions.filter((s) => s.id !== session.id), { ramp, deload: !!session.deload });
    return commit();
  }

  async function finish() {
    const done = doneSetCount(session), left = openSetCount(session);
    if (done === 0) return toast('Confirm at least one set first, or discard the workout.');
    if (left > 0) {
      const ok = await sheet({
        title: 'Finish workout?',
        body: h('p', { class: 'sheet-text' }, `${left} set${left === 1 ? ' is' : 's are'} not confirmed and will not be saved.`),
        actions: [{ label: 'Finish anyway', value: true, kind: 'primary' }, { label: 'Keep going', value: false }],
      });
      if (!ok) return;
    }
    rest = null;
    const finished = await finishWorkout(session);
    dropWakeLock();
    location.hash = `#summary/${finished.id}`;
  }

  async function discard() {
    const ok = await sheet({
      title: 'Discard this workout?',
      body: h('p', { class: 'sheet-text' }, 'Everything logged in this session will be deleted. The rotation will not move on.'),
      actions: [{ label: 'Discard', value: true, kind: 'danger' }, { label: 'Keep going', value: false }],
    });
    if (!ok) return;
    rest = null;
    await db.del('sessions', session.id);
    dropWakeLock();
    location.hash = '#today';
  }
}
