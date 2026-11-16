// Progress: strength charts, sessions per week, muscle volume, training calendar, records, shoulder report.
import * as db from '../db.js';
import { EXERCISES, hasWeight } from '../exercises.js';
import { exerciseSeries, loggedExercises, muscleVolume, sessionsPerWeek, recordsList, heatmap, shoulderReport } from '../stats.js';
import { lineChart, barChart } from '../chart.js';
import { TARGETS } from '../week.js';
import { prettyDate, parseYmd } from '../dates.js';
import { fmtKg } from '../format.js';
import { h, icon, sheet, card, emptyState, pageHeader } from '../ui.js';
import { chartCard } from '../fields.js';

let picked = null; // exercise shown in the strength charts

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sets = (n) => String(Number(n.toFixed(1)));

export async function render(root, { refresh }) {
  const [sessions, bike] = await Promise.all([db.getAll('sessions'), db.getAll('bike')]);
  const logged = loggedExercises(sessions);
  const now = new Date();

  root.append(pageHeader('Progress'));
  if (!logged.length && !bike.length) {
    root.append(emptyState({
      iconName: 'progress',
      title: 'Nothing to chart yet',
      text: 'Finish a workout or log a bike session and your charts, records and training calendar appear here.',
    }));
    return;
  }

  // ----- Strength per exercise -----
  if (logged.length) {
    if (!logged.includes(picked)) picked = logged[0];
    const ex = EXERCISES[picked];
    const data = exerciseSeries(sessions, picked);
    const weighted = hasWeight(ex) && data.some((p) => p.top > 0);
    const line = (pick, label, fmtY) => lineChart({
      label, fmtY,
      series: [{ points: data.map((p) => ({ t: p.t, y: pick(p) })).filter((p) => p.y > 0), style: 'line' }],
    });
    const one = (v) => String(Number(v.toFixed(1))), whole = (v) => String(Math.round(v));
    const latest = data[data.length - 1], first = data[0];
    const delta = (a, b) => (data.length > 1 && a > 0 && b > 0 ? ` (${b - a >= 0 ? '+' : ''}${fmtKg(b - a)} kg since start)` : '');

    root.append(h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Strength'),
      h('button', { class: 'picker', onclick: choose },
        h('span', { class: 'picker-text' }, h('span', { class: 'picker-name' }, ex.name),
          h('span', { class: 'picker-sub' }, `${data.length} session${data.length === 1 ? '' : 's'} · tap to change`)),
        icon('chevron')),
      ...(weighted ? [
        h('h3', { class: 'sub-title' }, `Top set weight · ${fmtKg(latest.top)} kg${delta(first.top, latest.top)}`),
        h('div', { class: 'chart-wrap', html: line((p) => p.top, 'Top set weight', one) }),
        h('h3', { class: 'sub-title' }, latest.e1rm > 0 ? `Estimated 1RM · ${fmtKg(latest.e1rm)} kg${delta(first.e1rm, latest.e1rm)}` : 'Estimated 1RM'),
        data.some((p) => p.e1rm > 0)
          ? h('div', { class: 'chart-wrap', html: line((p) => p.e1rm, 'Estimated 1RM', one) })
          : h('p', { class: 'dim' }, 'Shown for sets of 12 reps or fewer.'),
      ] : [
        h('h3', { class: 'sub-title' }, ex.mode === 'time' ? `Longest hold · ${latest.best} s` : `Best set · ${latest.best} reps`),
        h('div', { class: 'chart-wrap', html: line((p) => p.best, ex.mode === 'time' ? 'Longest hold' : 'Best set', whole) }),
      ]),
      data.length < 2 ? h('p', { class: 'chart-legend' }, 'A trend line appears after the second session.') : null));
  }

  // ----- Sessions per week -----
  const weeks = sessionsPerWeek(sessions, bike, now);
  root.append(chartCard('Sessions per week',
    barChart({ label: 'Sessions per week', target: TARGETS.lifts, bars: weeks.map((w) => ({ t: w.t, a: w.lifts, b: w.rides })) }),
    { legend: 'Lime: lifting. Grey: bike. Dashed line: 4 lifting sessions.' }));

  // ----- Weekly volume per muscle group -----
  const vol = muscleVolume(sessions, now);
  const most = Math.max(10, ...vol.map((v) => Math.max(v.sets, v.prev)));
  root.append(card('Volume this week · sets per muscle',
    h('div', { class: 'mv' }, vol.map((v) => h('div', { class: 'mv-row' },
      h('span', { class: 'mv-name' }, cap(v.muscle)),
      h('span', { class: 'mv-track' },
        h('span', { class: 'mv-fill', style: `width:${((v.sets / most) * 100).toFixed(1)}%` }),
        v.prev > 0 ? h('span', { class: 'mv-prev', style: `left:${((v.prev / most) * 100).toFixed(1)}%` }) : null),
      h('span', { class: 'mv-num' }, sets(v.sets))))),
    h('p', { class: 'chart-legend' }, 'Main muscle counts a full set, supporting muscles half. The tick marks last week.')));

  // ----- Calendar heat-map -----
  const grid = heatmap(sessions, bike, now);
  root.append(card('Training calendar · 12 weeks',
    h('div', { class: 'heat' },
      h('div', { class: 'heat-days' }, ['M', '', 'W', '', 'F', '', 'S'].map((d) => h('span', {}, d))),
      h('div', { class: 'heat-grid' }, grid.map((week) => h('div', { class: 'heat-col' }, week.map((d) =>
        h('span', {
          class: `heat-cell ${d.future ? 'future' : d.lift && d.bike ? 'both' : d.lift ? 'lift' : d.bike ? 'bike' : d.rest ? 'restday' : ''}`.trim(),
          title: d.date,
        })))))),
    h('div', { class: 'heat-legend' },
      h('span', {}, h('i', { class: 'heat-cell lift' }), 'Lift'),
      h('span', {}, h('i', { class: 'heat-cell bike' }), 'Bike'),
      h('span', {}, h('i', { class: 'heat-cell both' }), 'Both'),
      h('span', {}, h('i', { class: 'heat-cell restday' }), 'Rest day'))));

  // ----- Records -----
  const recs = recordsList(sessions);
  if (recs.length) {
    root.append(card('Records',
      h('div', { class: 'rec-list' }, recs.map((r) => h('div', { class: 'rec' },
        h('span', { class: 'rec-name' }, r.name),
        h('span', { class: 'rec-val' }, h('span', { class: 'rec-main' }, r.main), h('span', { class: 'rec-sub' }, r.sub)))))));
  }

  // ----- Shoulder report -----
  const flags = shoulderReport(sessions);
  root.append(card('Right shoulder report',
    flags.length
      ? h('div', { class: 'rec-list' }, flags.map((f) => h('div', { class: 'rec' },
        h('span', { class: 'rec-name' }, f.name),
        h('span', { class: 'rec-val' },
          h('span', { class: `rec-main ${f.pain ? 'red' : 'amber'}` }, [f.pain ? `Pain × ${f.pain}` : null, f.pop ? `Pop × ${f.pop}` : null].filter(Boolean).join(' · ')),
          h('span', { class: 'rec-sub' }, `in ${f.logged} session${f.logged === 1 ? '' : 's'} · last ${prettyDate(parseYmd(f.last), { short: true }).replace(/ \d{4}$/, '')}`)))))
      : h('p', { class: 'dim' }, 'No pops or pain logged. Flags you set on upper-body exercises during a workout show up here.'),
    flags.some((f) => f.pain) ? h('p', { class: 'note amber' }, 'Exercises with pain are worth swapping in Settings → Program. Persistent pain is a reason to see a physio.') : null));

  async function choose() {
    const pick = await sheet({
      title: 'Choose exercise',
      body: h('p', { class: 'sheet-text dim' }, 'Exercises you have logged, most trained first.'),
      actions: [...logged.map((id) => ({ label: EXERCISES[id].name, value: id, kind: id === picked ? 'plain on' : 'plain' })), { label: 'Cancel', value: null }],
    });
    if (!pick) return;
    picked = pick;
    refresh();
  }
}
