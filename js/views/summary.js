// Session summary shown when a workout is finished: numbers, records, feel and a note.
import * as db from '../db.js';
import { fmtDuration, fmtInt } from '../format.js';
import { doneSetCount } from '../session.js';
import { h, icon, card, segmented } from '../ui.js';

export async function render(root, { arg }) {
  const session = arg ? await db.get('sessions', arg) : null;
  if (!session || !session.finishedAt) { location.replace('#today'); return null; }

  const save = () => db.put('sessions', session);
  const note = h('textarea', {
    class: 'note-input', rows: '3', maxlength: '500',
    placeholder: 'Optional: how it went, shoulder, anything to remember',
  });
  note.value = session.note || '';
  note.addEventListener('change', () => { session.note = note.value.trim(); save(); });

  const prs = session.prs || [];
  const flagged = session.exercises.filter((e) => e.flag === 'pop' || e.flag === 'pain');

  root.classList.add('summary');
  root.append(...[
    h('header', { class: 'page-head' },
      h('div', { class: 'kicker' }, session.deload ? 'Deload workout complete' : 'Workout complete'),
      h('h1', { class: 'page-title' }, session.name)),

    h('div', { class: 'stats' },
      stat(fmtDuration(session.durationSec || 0), 'Duration'),
      stat(fmtInt(session.volume || 0), 'Volume kg'),
      stat(String(doneSetCount(session)), 'Sets')),

    card(prs.length ? `Personal records · ${prs.length}` : 'Personal records',
      prs.length
        ? h('ul', { class: 'pr-list' }, prs.map((p) =>
          h('li', {}, icon('trophy'), h('div', {}, h('div', { class: 'pr-name' }, p.name), h('div', { class: 'pr-text' }, p.text)))))
        : h('p', { class: 'dim' }, 'No records this time. The first session of each exercise sets your baseline.')),

    flagged.length ? card('Shoulder flags',
      h('ul', { class: 'flag-list' }, flagged.map((e) =>
        h('li', { class: e.flag === 'pain' ? 'red' : 'amber' }, `${e.name}: ${e.flag === 'pain' ? 'pain' : 'pop, no pain'}`)))) : null,

    card('How did it feel?',
      segmented({
        options: [1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n })), value: session.feel, label: 'Session feel',
        cls: 'feel', onChange: (v) => { session.feel = v; save(); },
      }),
      h('div', { class: 'feel-scale' }, h('span', {}, 'Rough'), h('span', {}, 'Great'))),

    card('Note', note),

    h('button', {
      class: 'btn primary big',
      onclick: async () => { session.note = note.value.trim(); await save(); location.hash = '#today'; },
    }, 'Done'),
  ].filter(Boolean));
  return null;
}

function stat(value, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-val' }, value), h('div', { class: 'stat-label' }, label));
}
