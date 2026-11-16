// Form fields and small display components used by the bike, check-in and body screens.
import { h } from './ui.js';

/**
 * Labelled number input that may be left empty. onChange(number | null).
 * The returned element has setValue(v) for filling it in from code.
 */
export function numField({ label, hint, value, unit = '', min, max, step = 'any', placeholder = '–', onChange }) {
  const input = h('input', {
    class: 'num-input', type: 'number', inputmode: 'decimal', placeholder, 'aria-label': label,
    min: min === undefined ? null : String(min), max: max === undefined ? null : String(max), step: String(step),
  });
  const show = (v) => { input.value = v === null || v === undefined || v === '' ? '' : String(v); };
  show(value);
  input.addEventListener('input', () => {
    const v = input.value.trim() === '' ? null : Number(input.value);
    onChange && onChange(Number.isFinite(v) ? v : null);
  });
  input.addEventListener('focus', () => input.select());
  const row = h('label', { class: 'row field' },
    h('div', { class: 'row-text' },
      h('div', { class: 'row-label' }, label),
      hint ? h('div', { class: 'row-hint' }, hint) : null),
    h('div', { class: 'num-wrap' }, input, unit ? h('span', { class: 'step-unit' }, unit) : null));
  row.setValue = show;
  return row;
}

export function dateField({ label, value, max, onChange }) {
  const input = h('input', { class: 'date-input', type: 'date', value: value || '', max: max || null, 'aria-label': label });
  input.addEventListener('change', () => onChange && onChange(input.value));
  return h('label', { class: 'row field' }, h('div', { class: 'row-label' }, label), input);
}

export function textField({ label, value = '', placeholder = '', maxlength = 40, onChange }) {
  const input = h('input', { class: 'text-input', type: 'text', value, placeholder, maxlength: String(maxlength), 'aria-label': label, autocomplete: 'off' });
  input.addEventListener('input', () => onChange && onChange(input.value));
  return h('label', { class: 'field-col' }, h('div', { class: 'row-label' }, label), input);
}

/** Horizontal progress bar. Turns solid accent at 100%. */
export function progressBar(value, target) {
  const frac = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  return h('div', { class: `bar ${frac >= 1 ? 'full' : ''}`.trim(), role: 'progressbar', 'aria-valuenow': String(Math.round(frac * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('div', { class: 'bar-fill', style: `transform: scaleX(${frac.toFixed(3)})` }));
}

/** Card holding a chart (SVG markup from chart.js), or a short message when there is no data. */
export function chartCard(title, svg, { empty = 'Not enough data yet.', legend = '', extra = null } = {}) {
  return h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, title),
    extra,
    svg ? h('div', { class: 'chart-wrap', html: svg }) : h('p', { class: 'dim' }, empty),
    svg && legend ? h('p', { class: 'chart-legend' }, legend) : null);
}

/** Big tappable tick row with an optional streak. */
export function checkRow({ label, sub, checked, streak, onToggle }) {
  return h('button', { class: `check-row ${checked ? 'on' : ''}`.trim(), role: 'checkbox', 'aria-checked': checked ? 'true' : 'false', onclick: onToggle },
    h('span', { class: 'check-box', html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' }),
    h('span', { class: 'check-text' },
      h('span', { class: 'check-label' }, label),
      sub ? h('span', { class: 'check-sub' }, sub) : null),
    streak > 0 ? h('span', { class: 'check-streak' }, `${streak} day${streak === 1 ? '' : 's'}`) : null);
}
