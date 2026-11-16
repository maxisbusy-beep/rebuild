// Small DOM helpers and shared components (no framework).

/**
 * Create an element. h('button', { class: 'btn', onclick: fn }, 'Label')
 * Strings become text nodes, so user-entered text is always safe.
 */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // only ever used with our own static markup
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  today: svg('<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12z"/>'),
  log: svg('<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  progress: svg('<path d="M3 20h18"/><path d="m4 15 5-5 4 3 7-8"/><path d="M15 5h5v5"/>'),
  body: svg('<circle cx="12" cy="4.5" r="2.2"/><path d="M5 9.5h14"/><path d="M12 9.5V15"/><path d="m8 22 4-7 4 7"/>'),
  settings: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>'),
  upload: svg('<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>'),
  shield: svg('<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.500 7.500-5 7.500-9.500V6z"/><path d="m9 12 2.200 2.200L15.500 10"/>'),
  alert: svg('<path d="M12 4 2.500 20h19z"/><path d="M12 10v4.500M12 17.500h.010"/>'),
  minus: svg('<path d="M6 12h12"/>'),
  plus: svg('<path d="M12 6v12M6 12h12"/>'),
  barbell: svg('<path d="M2.500 12h19"/><path d="M6 7v10M9 5v14M15 5v14M18 7v10"/>'),
  bike: svg('<circle cx="6" cy="16.500" r="3.500"/><circle cx="18" cy="16.500" r="3.500"/><path d="M6 16.500 10 8h5l3 8.500"/><path d="M8.500 11h7.500"/><path d="M9 8H7"/>'),
  scale: svg('<rect x="4" y="4" width="16" height="16" rx="3.500"/><path d="M8.500 9.500a5 5 0 0 1 7 0"/><path d="m12 12 1.500-2.500"/>'),
};

export function icon(name, cls = '') {
  return h('span', { class: `icon ${cls}`.trim(), html: ICONS[name] || '' });
}

/** Brief message at the bottom of the screen. Optional action button. */
export function toast(message, { action, onAction, duration = 3500, tone = '' } = {}) {
  const root = document.getElementById('toasts');
  const el = h('div', { class: `toast ${tone}`.trim(), role: 'status' }, h('span', { class: 'toast-msg' }, message));
  const close = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  if (action) el.append(h('button', { class: 'toast-action', onclick: () => { close(); onAction && onAction(); } }, action));
  root.append(el);
  if (duration) setTimeout(close, duration);
  return close;
}

/**
 * Bottom sheet dialog. Resolves with the chosen action's value (null if dismissed).
 * actions: [{ label, value, kind: 'primary' | 'danger' | 'ghost' }]
 */
export function sheet({ title, body, actions = [] }) {
  return new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const prevFocus = document.activeElement;
    const done = (value) => {
      wrap.classList.add('leaving');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => {
        wrap.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      }, 220);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-grip' }),
      h('h2', { class: 'sheet-title' }, title),
      h('div', { class: 'sheet-body' }, body),
      h('div', { class: 'sheet-actions' }, actions.map((a) =>
        h('button', { class: `btn ${a.kind || 'ghost'}`, onclick: () => done(a.value) }, a.label))),
    );
    const wrap = h('div', { class: 'sheet-wrap' },
      h('div', { class: 'sheet-backdrop', onclick: () => done(null) }),
      panel);
    document.addEventListener('keydown', onKey);
    root.append(wrap);
    const first = panel.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  });
}

/**
 * Progress ring (hand-drawn SVG).
 * value/target drive the arc; `big` is the large number, `label` the caption.
 */
export function ring({ value, target, big, label, sub }) {
  const r = 36, c = 2 * Math.PI * r;
  const frac = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const done = frac >= 1;
  const markup = `
    <svg viewBox="0 0 88 88" class="ring-svg" role="img" aria-label="${label}: ${big}">
      <circle cx="44" cy="44" r="${r}" class="ring-track"/>
      ${frac > 0 ? `<circle cx="44" cy="44" r="${r}" class="ring-arc${done ? ' done' : ''}"
        stroke-dasharray="${(c * frac).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 44 44)"/>` : ''}
    </svg>`;
  return h('div', { class: 'ring' },
    h('div', { class: 'ring-fig' },
      h('div', { html: markup }),
      h('div', { class: 'ring-num' }, String(big))),
    h('div', { class: 'ring-label' }, label),
    sub ? h('div', { class: 'ring-sub' }, sub) : null);
}

/**
 * Number row with big minus / plus buttons and a typeable value.
 * onChange(value) is called with a clamped number.
 */
export function stepper({ label, hint, value, step = 1, min = 0, max = 999, unit = '', onChange }) {
  let current = value;
  const input = h('input', {
    class: 'step-input', type: 'number', inputmode: 'decimal', value: String(value),
    min: String(min), max: String(max), step: String(step), 'aria-label': label,
  });
  const set = (v, fromInput = false) => {
    if (!Number.isFinite(v)) v = current;
    v = Math.max(min, Math.min(max, Math.round(v / step) * step));
    v = Number(v.toFixed(2));
    if (!fromInput || String(v) !== input.value) input.value = String(v);
    if (v !== current) { current = v; onChange && onChange(v); }
  };
  input.addEventListener('change', () => set(parseFloat(input.value), true));
  input.addEventListener('focus', () => input.select());
  return h('div', { class: 'row' },
    h('div', { class: 'row-text' },
      h('div', { class: 'row-label' }, label),
      hint ? h('div', { class: 'row-hint' }, hint) : null),
    h('div', { class: 'stepper' },
      h('button', { class: 'step-btn', 'aria-label': `Decrease ${label}`, onclick: () => set(current - step) }, icon('minus')),
      h('div', { class: 'step-val' }, input, unit ? h('span', { class: 'step-unit' }, unit) : null),
      h('button', { class: 'step-btn', 'aria-label': `Increase ${label}`, onclick: () => set(current + step) }, icon('plus'))));
}

/** Friendly placeholder for a screen or card with nothing in it yet. */
export function emptyState({ iconName, title, text }) {
  return h('div', { class: 'empty' },
    icon(iconName, 'empty-icon'),
    h('h2', { class: 'empty-title' }, title),
    h('p', { class: 'empty-text' }, text));
}

export function pageHeader(title, kicker) {
  return h('header', { class: 'page-head' },
    kicker ? h('div', { class: 'kicker' }, kicker) : null,
    h('h1', { class: 'page-title' }, title));
}

export function card(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h2', { class: 'card-title' }, title) : null, ...kids);
}
