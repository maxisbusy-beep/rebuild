// Log: history of lifting sessions (bike sessions join in phase 3).
import * as db from '../db.js';
import { fmtDuration, fmtInt, setsLabel } from '../format.js';
import { weekdayName, prettyDate, parseYmd } from '../dates.js';
import { h, icon, sheet, toast, emptyState, pageHeader } from '../ui.js';

const FLAG_TEXT = { pop: 'pop, no pain', pain: 'pain' };

export async function render(root, { refresh }) {
  const sessions = (await db.getAll('sessions'))
    .filter((s) => s.type === 'lift' && s.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt);

  root.append(pageHeader('Log'));
  if (!sessions.length) {
    root.append(emptyState({
      iconName: 'barbell',
      title: 'No sessions yet',
      text: 'Finished workouts are listed here. Start one from the Today tab.',
    }));
    return;
  }

  root.append(h('div', { class: 'log-list' }, sessions.map((s) => {
    const d = parseYmd(s.date);
    const prs = (s.prs || []).length;
    return h('button', { class: 'card log-item', onclick: () => detail(s, refresh) },
      h('div', { class: 'log-main' },
        h('div', { class: 'log-date' }, `${weekdayName(d).slice(0, 3)} ${prettyDate(d, { short: true })}`),
        h('div', { class: 'log-name' }, s.name),
        h('div', { class: 'log-meta' }, [
          fmtDuration(s.durationSec || 0), `${fmtInt(s.volume || 0)} kg`,
          prs ? `${prs} record${prs === 1 ? '' : 's'}` : null, s.feel ? `feel ${s.feel}/5` : null,
        ].filter(Boolean).join(' · '))),
      icon('chevron', 'log-chev'));
  })));
}

async function detail(s, refresh) {
  const body = h('div', { class: 'detail' },
    h('p', { class: 'sheet-text dim' }, `${prettyDate(parseYmd(s.date), { short: true })} · ${fmtDuration(s.durationSec || 0)} · ${fmtInt(s.volume || 0)} kg`),
    h('ul', { class: 'detail-list' }, s.exercises.map((e) => h('li', {},
      h('div', { class: 'detail-name' }, e.name),
      h('div', { class: 'detail-sets' }, setsLabel(e.exId, e.sets)),
      FLAG_TEXT[e.flag] ? h('div', { class: `detail-flag ${e.flag === 'pain' ? 'red' : 'amber'}` }, `Shoulder: ${FLAG_TEXT[e.flag]}`) : null))),
    (s.prs || []).length ? h('ul', { class: 'pr-list' }, s.prs.map((p) =>
      h('li', {}, icon('trophy'), h('div', {}, h('div', { class: 'pr-name' }, p.name), h('div', { class: 'pr-text' }, p.text))))) : null,
    s.note ? h('p', { class: 'sheet-text detail-note' }, s.note) : null);

  const choice = await sheet({
    title: s.name,
    body,
    actions: [{ label: 'Close', value: null, kind: 'primary' }, { label: 'Delete this session', value: 'delete', kind: 'danger' }],
  });
  if (choice !== 'delete') return;
  const sure = await sheet({
    title: 'Delete this session?',
    body: h('p', { class: 'sheet-text' }, 'It will be removed from your history, records and rotation. This cannot be undone.'),
    actions: [{ label: 'Delete', value: true, kind: 'danger' }, { label: 'Cancel', value: false }],
  });
  if (!sure) return;
  await db.del('sessions', s.id);
  toast('Session deleted.');
  refresh();
}
