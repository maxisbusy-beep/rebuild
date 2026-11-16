// Daily check-ins shown on Today: protein tally, creatine, mobility, sleep.
import * as db from '../db.js';
import { ymd } from '../dates.js';
import { withDay, proteinTotal, addProtein, undoProtein, habitStreak, cleanFood, PROTEIN_QUICK, MOBILITY_MOVES } from '../daily.js';
import { h, sheet, toast, stepper, card } from '../ui.js';
import { progressBar, checkRow, textField } from '../fields.js';

/** Returns the check-in cards for today. */
export async function checkinCards(refresh, settings) {
  const date = ymd();
  const [rec, all, foods] = await Promise.all([db.get('daily', date), db.getAll('daily'), db.getKV('foods', [])]);
  const day = withDay(rec, date);
  const save = async (next) => { await db.put('daily', next); refresh(); };
  const total = proteinTotal(day);
  const target = settings.proteinTarget;
  const left = Math.max(0, target - total);

  async function custom() {
    const draft = { g: 25, name: '' };
    const ok = await sheet({
      title: 'Add protein',
      body: h('div', { class: 'edit-set' },
        stepper({ label: 'Protein', value: draft.g, step: 5, min: 1, max: 300, unit: 'g', onChange: (v) => { draft.g = v; } }),
        textField({ label: 'Save as a quick-add (optional)', placeholder: 'e.g. Whey shake', maxlength: 30, onChange: (v) => { draft.name = v; } })),
      actions: [{ label: 'Add', value: true, kind: 'primary' }, { label: 'Cancel', value: false }],
    });
    if (!ok) return;
    const food = cleanFood(draft.name, draft.g);
    if (food) await db.setKV('foods', [...foods.filter((f) => f.name.toLowerCase() !== food.name.toLowerCase()), food]);
    await save(addProtein(day, draft.g, food ? food.name : ''));
  }

  async function editFoods() {
    const pick = await sheet({
      title: 'Quick-add foods',
      body: h('p', { class: 'sheet-text dim' }, 'Tap one to remove it. Add new ones with Custom.'),
      actions: [...foods.map((f) => ({ label: `Remove ${f.name} (${f.g} g)`, value: f.name, kind: 'plain' })), { label: 'Close', value: null }],
    });
    if (!pick) return;
    await db.setKV('foods', foods.filter((f) => f.name !== pick));
    toast(`${pick} removed.`);
    refresh();
  }

  const chip = (label, onclick, cls = '') => h('button', { class: `chip ${cls}`.trim(), onclick }, label);
  const lastSleep = all.filter((d) => d.sleep !== null && d.sleep !== undefined && d.date !== date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const sleepDefault = lastSleep ? lastSleep.sleep : 7.5;

  return [
    card('Protein',
      h('div', { class: 'tally' },
        h('span', { class: 'tally-num' }, String(total)),
        h('span', { class: 'tally-of' }, `/ ${target} g`),
        h('span', { class: `tally-left ${left === 0 ? 'good' : ''}`.trim() }, left === 0 ? 'Target hit' : `${left} g to go`)),
      progressBar(total, target),
      h('div', { class: 'chips' },
        PROTEIN_QUICK.map((g) => chip(`+${g}`, () => save(addProtein(day, g)), 'strong')),
        chip('Custom', custom)),
      foods.length ? h('div', { class: 'chips' }, foods.map((f) => chip(`${f.name} ${f.g}`, () => save(addProtein(day, f.g, f.name))))) : null,
      (day.protein.length || foods.length) ? h('div', { class: 'link-row' },
        day.protein.length ? h('button', { class: 'link', onclick: () => save(undoProtein(day)) }, `Undo last (${day.protein[day.protein.length - 1].g} g)`) : h('span', {}),
        foods.length ? h('button', { class: 'link', onclick: editFoods }, 'Edit quick-adds') : null) : null),

    card('Daily',
      checkRow({
        label: 'Creatine 5 g', checked: day.creatine, streak: habitStreak(all, 'creatine', date),
        onToggle: () => save({ ...day, creatine: !day.creatine }),
      }),
      checkRow({
        label: 'Mobility 5–10 min', sub: MOBILITY_MOVES.join(' · '), checked: day.mobility, streak: habitStreak(all, 'mobility', date),
        onToggle: () => save({ ...day, mobility: !day.mobility }),
      }),
      day.sleep === null || day.sleep === undefined
        ? h('div', { class: 'row' },
          h('div', { class: 'row-text' }, h('div', { class: 'row-label' }, 'Sleep last night'), h('div', { class: 'row-hint' }, 'Not logged yet')),
          h('button', { class: 'btn small fit', onclick: () => save({ ...day, sleep: sleepDefault }) }, 'Log sleep'))
        : stepper({
          label: 'Sleep last night', hint: 'Hours', value: day.sleep, step: 0.5, min: 0, max: 16, unit: 'h',
          onChange: (v) => save({ ...day, sleep: v }),
        })),
  ];
}
