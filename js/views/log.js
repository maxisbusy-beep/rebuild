// Log: history of lifting sessions (#log) and bike sessions with trends (#log/bike).
import * as db from '../db.js';
import { loadSettings, easyZone } from '../settings.js';
import { fmtDuration, fmtInt, setsLabel } from '../format.js';
import { weekdayName, prettyDate, parseYmd } from '../dates.js';
import { weekStats, TARGETS } from '../week.js';
import { avgSpeed, series, resistanceLevels, hrAtResistance } from '../bike.js';
import { lineChart } from '../chart.js';
import { h, icon, sheet, toast, emptyState, pageHeader, segmented, card } from '../ui.js';
import { progressBar, chartCard } from '../fields.js';

const FLAG_TEXT = { pop: 'pop, no pain', pain: 'pain' };
const dayLine = (date) => { const d = parseYmd(date); return `${weekdayName(d).slice(0, 3)} ${prettyDate(d, { short: true })}`; };
let hrLevel = null; // resistance level chosen for the heart-rate chart

export async function render(root, { refresh, arg }) {
  const mode = arg === 'bike' ? 'bike' : 'lift';
  root.append(
    pageHeader('Log'),
    segmented({
      options: [{ label: 'Lifting', value: 'lift' }, { label: 'Bike', value: 'bike' }], value: mode, label: 'Log type',
      onChange: (v) => { location.hash = v === 'bike' ? '#log/bike' : '#log'; },
    }));
  if (mode === 'bike') return renderBike(root, refresh);
  return renderLifts(root, refresh);
}

// ---------- Lifting ----------

async function renderLifts(root, refresh) {
  const sessions = (await db.getAll('sessions'))
    .filter((s) => s.type === 'lift' && s.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt);

  if (!sessions.length) {
    root.append(emptyState({
      iconName: 'barbell',
      title: 'No sessions yet',
      text: 'Finished workouts are listed here. Start one from the Today tab.',
    }));
    return;
  }

  root.append(h('div', { class: 'log-list' }, sessions.map((s) => {
    const prs = (s.prs || []).length;
    return h('button', { class: 'card log-item', onclick: () => detail(s, refresh) },
      h('div', { class: 'log-main' },
        h('div', { class: 'log-date' }, dayLine(s.date)),
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

// ---------- Bike ----------

async function renderBike(root, refresh) {
  const [rides, settings] = await Promise.all([db.getAll('bike'), loadSettings()]);
  rides.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0)));
  const week = weekStats([], rides, new Date());
  const zone = easyZone(settings);

  root.append(
    card('This week',
      h('div', { class: 'tally' },
        h('span', { class: 'tally-num' }, String(week.minutes)),
        h('span', { class: 'tally-of' }, `/ ${TARGETS.cardioMin}–${TARGETS.cardioMax} min`),
        h('span', { class: `tally-left ${week.rides >= TARGETS.ridesMin ? 'good' : ''}`.trim() }, `${week.rides} of ${TARGETS.ridesMin}–${TARGETS.ridesMax} sessions`)),
      progressBar(week.minutes, TARGETS.cardioMin),
      h('p', { class: 'note' }, `Easy cardio zone: ${zone.low}–${zone.high} bpm (60–70% of max).`)),
    h('a', { class: 'btn primary big', href: '#bike' }, icon('bike'), 'Log bike session'));

  if (!rides.length) {
    root.append(emptyState({ iconName: 'bike', title: 'No bike sessions yet', text: 'Use the stopwatch or enter a session afterwards. Only the duration is required.' }));
    return;
  }

  const levels = resistanceLevels(rides).slice(0, 4);
  if (!levels.includes(hrLevel)) hrLevel = levels.length ? levels[0] : null;
  const chart = (pts, label, fmtY) => (pts.length ? lineChart({ label, fmtY, series: [{ points: pts, style: 'line' }] }) : '');
  const one = (v) => v.toFixed(1), whole = (v) => String(Math.round(v));

  root.append(
    chartCard('Distance · km', chart(series(rides, (r) => (r.distance > 0 ? r.distance : null)), 'Distance', one), { empty: 'Add a distance to see this trend.' }),
    chartCard('Average speed · km/h', chart(series(rides, avgSpeed), 'Average speed', one), { empty: 'Needs distance and duration.' }),
    chartCard('Heart rate at resistance', hrLevel === null ? '' : chart(hrAtResistance(rides, hrLevel), `Heart rate at resistance ${hrLevel}`, whole), {
      empty: 'Log resistance and average heart rate to see this trend.',
      legend: 'Falling at the same resistance means your fitness is improving.',
      extra: levels.length > 1 ? segmented({
        options: levels.map((l) => ({ label: `Level ${l}`, value: l })), value: hrLevel, label: 'Resistance level',
        onChange: (v) => { hrLevel = v; refresh(); },
      }) : (hrLevel !== null ? h('p', { class: 'note' }, `Level ${hrLevel}`) : null),
    }),
    h('div', { class: 'log-list' }, rides.map((r) => {
      const sp = avgSpeed(r);
      return h('a', { class: 'card log-item', href: `#bike/${r.id}` },
        h('div', { class: 'log-main' },
          h('div', { class: 'log-date' }, dayLine(r.date)),
          h('div', { class: 'log-name' }, `${fmtInt(r.duration)} min`),
          h('div', { class: 'log-meta' }, [
            r.distance > 0 ? `${r.distance} km` : null, sp ? `${sp.toFixed(1)} km/h` : null,
            r.resistance !== null && r.resistance !== undefined ? `level ${r.resistance}` : null,
            r.avgHr > 0 ? `${r.avgHr} bpm` : null, r.calories > 0 ? `${r.calories} kcal` : null, r.feel ? `feel ${r.feel}/5` : null,
          ].filter(Boolean).join(' · ') || 'Duration only')),
        icon('chevron', 'log-chev'));
    })));
}
