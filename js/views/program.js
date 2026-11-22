// Program editor (Settings > Program): sets, rep ranges and exercise swaps.
import { loadProgram, saveProgram, defaultProgram, normalizeItem, swapItem, rxLabel, DEFAULT_PROGRAM } from '../program.js';
import { EXERCISES } from '../exercises.js';
import { h, icon, sheet, toast, stepper, card } from '../ui.js';
import { animationButton } from '../anim-ui.js';

export async function render(root, { refresh }) {
  const program = await loadProgram();
  const commit = async () => { await saveProgram(program); refresh(); };

  root.append(
    h('header', { class: 'page-head with-back' },
      h('a', { class: 'icon-btn', href: '#settings', 'aria-label': 'Back to Settings' }, icon('back')),
      h('h1', { class: 'page-title' }, 'Program')),
    h('p', { class: 'note' }, 'Tap an exercise to change its sets, rep range, or swap it for an alternative. Changes apply from your next workout.'),
    ...program.order.map((key) => {
      const w = program.workouts[key];
      return card(w.name, h('div', { class: 'prog-list' }, w.items.map((it, i) =>
        h('button', { class: 'prog-item', onclick: () => edit(key, i) },
          h('span', { class: 'prog-text' },
            h('span', { class: 'prog-name' }, EXERCISES[it.exId].name),
            h('span', { class: 'prog-rx' }, rxLabel(it))),
          icon('chevron')))));
    }),
    h('button', { class: 'btn ghost', onclick: reset }, 'Reset program to default'));

  async function edit(key, i) {
    const items = program.workouts[key].items;
    const it = items[i], ex = EXERCISES[it.exId];
    const draft = { ...it };
    const body = h('div', { class: 'edit-set' },
      h('p', { class: 'sheet-text dim' }, ex.cue),
      h('div', { class: 'ex-actions' }, animationButton(it.exId)),
      stepper({ label: 'Sets', value: draft.sets, min: 1, max: 8, onChange: (v) => { draft.sets = v; } }),
      ex.mode === 'reps' ? stepper({ label: 'Reps from', value: draft.repMin, min: 1, max: 50, onChange: (v) => { draft.repMin = v; } }) : null,
      ex.mode === 'reps' ? stepper({ label: 'Reps to', value: draft.repMax, min: 1, max: 50, onChange: (v) => { draft.repMax = v; } }) : null,
      ex.mode === 'time' ? stepper({ label: 'Hold', value: draft.repMax, step: 5, min: 5, max: 600, unit: 's', onChange: (v) => { draft.repMax = v; draft.repMin = v; } }) : null,
      ex.mode === 'amrap' ? h('p', { class: 'note' }, 'As many reps as possible each set.') : null);
    const choice = await sheet({
      title: ex.name,
      body,
      actions: [{ label: 'Save', value: 'save', kind: 'primary' }, { label: 'Swap exercise', value: 'swap' }, { label: 'Cancel', value: null }],
    });
    if (!choice) return;
    items[i] = normalizeItem(draft);
    if (choice === 'swap') {
      const original = DEFAULT_PROGRAM.workouts[key].items[i];
      const options = [...new Set([...(original && original.exId !== it.exId ? [original.exId] : []), ...ex.swaps])]
        .filter((id) => !items.some((x) => x.exId === id));
      const pick = await sheet({
        title: `Swap ${ex.name}`,
        body: h('p', { class: 'sheet-text dim' }, 'Alternatives that use only your equipment.'),
        actions: [...options.map((id) => ({ label: EXERCISES[id].name, value: id, kind: 'plain' })), { label: 'Cancel', value: null }],
      });
      if (pick) items[i] = swapItem(items[i], pick);
    }
    await commit();
  }

  async function reset() {
    const ok = await sheet({
      title: 'Reset the program?',
      body: h('p', { class: 'sheet-text' }, 'All four workouts go back to the original exercises, sets and rep ranges. Your logged sessions are not affected.'),
      actions: [{ label: 'Reset', value: true, kind: 'danger' }, { label: 'Cancel', value: false }],
    });
    if (!ok) return;
    await saveProgram(defaultProgram());
    toast('Program reset.');
    refresh();
  }
}
