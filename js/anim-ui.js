// The Animation viewer: an animated stick figure of the movement, a body map of the
// muscles it works, and written instructions. Opened by the "Animation" button under
// an exercise name.

import { EXERCISES } from './exercises.js';
import { animationFor, hasAnimation, MUSCLE_LABEL, SEG, STAND, GROUND, VIEW } from './anim.js';
import { h, icon } from './ui.js';

export { hasAnimation };

const CYCLE = 3000; // ms for one down-and-up cycle
const rad = (d) => (d * Math.PI) / 180;
const at = (p, ang, len) => [p[0] + len * Math.cos(rad(ang)), p[1] - len * Math.sin(rad(ang))];
const n1 = (v) => Math.round(v * 10) / 10;

// Scenery per movement, in the figure's own coordinates.
const PROPS = {
  bench: [{ x: 58, y: 157, w: 146, h: 9, legs: true }],
  skull: [{ x: 58, y: 157, w: 146, h: 9, legs: true }],
  hipthrust: [{ x: 16, y: 158, w: 92, h: 9, legs: true }],
  onearmrow: [{ x: 146, y: 150, w: 86, h: 9, legs: true }],
  splitsquat: [{ x: 26, y: 176, w: 70, h: 9, legs: true }],
  stepup: [{ x: 134, y: 170, w: 92, h: 26 }],
};

// ---------------------------------------------------------------- pose maths

/** Fill in every joint of a pose, so two poses always have the same keys to blend. */
function fullPose(p) {
  const f = { ...STAND, upperLen: SEG.upper, foreLen: SEG.fore, thighLen: SEG.thigh, shinLen: SEG.shin, ...p };
  f.thigh2 = p.thigh2 ?? f.thigh;
  f.shin2 = p.shin2 ?? f.shin;
  f.foot2 = p.foot2 ?? f.foot;
  f.upper2 = p.upper2 ?? f.upper;
  f.fore2 = p.fore2 ?? f.fore;
  return f;
}

const ANGLES = new Set(['torso', 'thigh', 'shin', 'foot', 'upper', 'fore', 'thigh2', 'shin2', 'foot2', 'upper2', 'fore2']);

/** Blend two poses. Angles take the short way round so nothing spins. */
function blend(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) {
    if (ANGLES.has(k)) {
      let d = ((b[k] - a[k] + 540) % 360) - 180;
      out[k] = a[k] + d * t;
    } else {
      out[k] = a[k] + (b[k] - a[k]) * t;
    }
  }
  return out;
}

/** Joint positions for a filled-in pose. */
function joints(p) {
  const hip = [p.hipX, p.hipY];
  const neck = at(hip, p.torso, SEG.torso);
  const head = at(neck, p.torso, SEG.neckToHead);
  const knee = at(hip, p.thigh, p.thighLen);
  const ankle = at(knee, p.shin, p.shinLen);
  const toe = at(ankle, p.foot, SEG.foot);
  const elbow = at(neck, p.upper, p.upperLen);
  const hand = at(elbow, p.fore, p.foreLen);
  const knee2 = at(hip, p.thigh2, p.thighLen);
  const ankle2 = at(knee2, p.shin2, p.shinLen);
  const toe2 = at(ankle2, p.foot2, SEG.foot);
  const elbow2 = at(neck, p.upper2, p.upperLen);
  const hand2 = at(elbow2, p.fore2, p.foreLen);
  return { hip, neck, head, knee, ankle, toe, elbow, hand, knee2, ankle2, toe2, elbow2, hand2 };
}

// ---------------------------------------------------------------- figure drawing

const line = (a, b, cls) => `<line x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}" class="${cls}"/>`;

function equipMarkup(anim, j) {
  const spot = anim.equipAt === 'hip' ? j.hip : anim.equipAt === 'none' ? null : j.hand;
  if (!spot) return '';
  const [x, y] = [n1(spot[0]), n1(spot[1])];
  if (anim.equip === 'bb') {
    // Seen end-on: the plates read as a disc.
    return `<circle cx="${x}" cy="${y}" r="9" class="fig-plate"/><circle cx="${x}" cy="${y}" r="3" class="fig-plate-hub"/>`;
  }
  if (anim.equip === 'db') {
    const two = anim.pair && anim.equipAt === 'hands';
    const one = (px, py) => `<rect x="${n1(px - 9)}" y="${n1(py - 4)}" width="18" height="8" rx="3" class="fig-db"/>`
      + `<rect x="${n1(px - 11)}" y="${n1(py - 6)}" width="5" height="12" rx="2" class="fig-db"/>`
      + `<rect x="${n1(px + 6)}" y="${n1(py - 6)}" width="5" height="12" rx="2" class="fig-db"/>`;
    return two ? one(x, y) + one(j.hand2[0], j.hand2[1]) : one(x, y);
  }
  if (anim.equip === 'band' && anim.archId === 'pullapart') {
    // The band runs between the two hands.
    const [bx, by] = j.hand2;
    return `<path d="M ${n1(bx)} ${n1(by)} L ${x} ${y}" class="fig-band"/>`;
  }
  if (anim.equip === 'band' && anim.anchor) {
    const [ax, ay] = anim.anchor;
    const mx = (ax + x) / 2, my = (ay + y) / 2 + 10;
    return `<circle cx="${ax}" cy="${ay}" r="4" class="fig-anchor"/>`
      + `<path d="M ${ax} ${ay} Q ${n1(mx)} ${n1(my)} ${x} ${y}" class="fig-band"/>`;
  }
  return '';
}

function propsMarkup(anim) {
  const rects = PROPS[anim.archId] || [];
  let out = '';
  for (const r of rects) {
    out += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" class="fig-prop"/>`;
    if (r.legs) {
      const y2 = GROUND;
      out += `<rect x="${r.x + 6}" y="${r.y + r.h}" width="7" height="${y2 - r.y - r.h}" class="fig-prop"/>`;
      out += `<rect x="${r.x + r.w - 13}" y="${r.y + r.h}" width="7" height="${y2 - r.y - r.h}" class="fig-prop"/>`;
    }
  }
  if (anim.prop === 'barOverhead') {
    out += `<rect x="40" y="28" width="160" height="7" rx="3.5" class="fig-prop"/>`;
    out += `<rect x="40" y="8" width="7" height="22" class="fig-prop"/>`;
    out += `<rect x="193" y="8" width="7" height="22" class="fig-prop"/>`;
  }
  return out;
}

function figureMarkup(anim, p) {
  const j = joints(p);
  let s = '';
  if (anim.ground) s += `<line x1="4" y1="${GROUND}" x2="${VIEW.w - 4}" y2="${GROUND}" class="fig-ground"/>`;
  s += propsMarkup(anim);
  // Far side limbs first, so the near side reads on top.
  s += line(j.hip, j.knee2, 'fig-limb far') + line(j.knee2, j.ankle2, 'fig-limb far') + line(j.ankle2, j.toe2, 'fig-foot far');
  s += line(j.neck, j.elbow2, 'fig-limb far') + line(j.elbow2, j.hand2, 'fig-limb far');
  s += line(j.hip, j.neck, 'fig-spine');
  s += line(j.hip, j.knee, 'fig-limb') + line(j.knee, j.ankle, 'fig-limb') + line(j.ankle, j.toe, 'fig-foot');
  s += line(j.neck, j.elbow, 'fig-limb') + line(j.elbow, j.hand, 'fig-limb');
  s += `<circle cx="${n1(j.head[0])}" cy="${n1(j.head[1])}" r="${SEG.headR}" class="fig-head"/>`;
  s += equipMarkup(anim, j);
  return s;
}

/**
 * The animated figure. Returns the element plus controls.
 * Loops down-and-up through the poses and labels the phase it is in.
 */
function figure(anim) {
  const poses = anim.poses.map(fullPose);
  const svg = h('div', { class: 'fig-svg' });
  const phase = h('div', { class: 'fig-phase' }, poses[0].label || '');
  const paint = (t) => {
    // t 0..1 across the whole movement, forward then back.
    const span = poses.length - 1;
    const x = Math.min(0.9999, t) * span;
    const i = Math.floor(x);
    const eased = (1 - Math.cos(Math.PI * (x - i))) / 2;
    const p = blend(poses[i], poses[i + 1], eased);
    svg.innerHTML = `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" class="fig" role="img" aria-label="${anim.name} movement">${figureMarkup(anim, p)}</svg>`;
    const near = Math.round(x);
    const label = poses[Math.min(poses.length - 1, near)].label;
    if (label && phase.textContent !== label) phase.textContent = label;
  };

  let raf = 0, playing = true, started = 0, offset = 0;
  const frame = (now) => {
    if (!started) started = now;
    const ms = (now - started + offset) % (CYCLE * 2);
    const t = ms < CYCLE ? ms / CYCLE : 2 - ms / CYCLE;
    paint(t);
    if (playing) raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (playing && raf) return;
    playing = true; started = 0;
    raf = requestAnimationFrame(frame);
  };
  const pause = () => { playing = false; cancelAnimationFrame(raf); raf = 0; };
  paint(0);
  play();

  const toggle = h('button', { class: 'btn ghost small fig-toggle', onclick: () => {
    if (playing) { pause(); toggle.replaceChildren(icon('play'), document.createTextNode('Play')); }
    else { play(); toggle.replaceChildren(icon('pause'), document.createTextNode('Pause')); }
  } }, icon('pause'), 'Pause');

  const el = h('div', { class: 'fig-wrap' }, svg, phase, h('div', { class: 'fig-controls' }, toggle));
  return { el, stop: pause };
}

// ---------------------------------------------------------------- muscle map

/** One body outline with a highlight layer per muscle group. */
function bodySvg(view, cx, muscles) {
  const prim = muscles[0];
  const cls = (m) => `m m-${m}` + (muscles.includes(m) ? (m === prim ? ' on primary' : ' on') : '');
  const r = (m, x, y, w, hh, rx = 5) => `<rect class="${cls(m)}" x="${n1(cx + x)}" y="${y}" width="${w}" height="${hh}" rx="${rx}"/>`;
  const base = [
    `<circle class="b" cx="${cx}" cy="20" r="11"/>`,
    `<rect class="b" x="${cx - 5}" y="28" width="10" height="8" rx="3"/>`,
    `<rect class="b" x="${cx - 17}" y="34" width="34" height="46" rx="10"/>`,
    `<rect class="b" x="${cx - 15}" y="74" width="30" height="20" rx="7"/>`,
    `<ellipse class="b" cx="${cx - 20}" cy="41" rx="9" ry="8"/>`,
    `<ellipse class="b" cx="${cx + 20}" cy="41" rx="9" ry="8"/>`,
    `<rect class="b" x="${cx - 28}" y="44" width="10" height="30" rx="5"/>`,
    `<rect class="b" x="${cx + 18}" y="44" width="10" height="30" rx="5"/>`,
    `<rect class="b" x="${cx - 29}" y="70" width="9" height="30" rx="4.5"/>`,
    `<rect class="b" x="${cx + 20}" y="70" width="9" height="30" rx="4.5"/>`,
    `<rect class="b" x="${cx - 15}" y="90" width="14" height="42" rx="7"/>`,
    `<rect class="b" x="${cx + 1}" y="90" width="14" height="42" rx="7"/>`,
    `<rect class="b" x="${cx - 14}" y="128" width="12" height="38" rx="6"/>`,
    `<rect class="b" x="${cx + 2}" y="128" width="12" height="38" rx="6"/>`,
    `<ellipse class="b" cx="${cx - 8}" cy="168" rx="7" ry="4"/>`,
    `<ellipse class="b" cx="${cx + 8}" cy="168" rx="7" ry="4"/>`,
  ].join('');

  const shoulders = `<ellipse class="${cls('shoulders')}" cx="${cx - 20}" cy="41" rx="8" ry="7"/>`
    + `<ellipse class="${cls('shoulders')}" cx="${cx + 20}" cy="41" rx="8" ry="7"/>`;
  const calves = r('calves', -13, 130, 10, 26, 5) + r('calves', 3, 130, 10, 26, 5);

  const front = shoulders
    + r('chest', -15, 36, 14, 18, 6) + r('chest', 1, 36, 14, 18, 6)
    + r('core', -11, 56, 22, 26, 6)
    + r('biceps', -26, 46, 8, 20, 4) + r('biceps', 18, 46, 8, 20, 4)
    + r('quads', -14, 92, 12, 38, 6) + r('quads', 2, 92, 12, 38, 6)
    + calves;

  const back = shoulders
    + r('back', -16, 35, 32, 30, 9)
    + r('triceps', -26, 46, 8, 20, 4) + r('triceps', 18, 46, 8, 20, 4)
    + r('glutes', -14, 75, 13, 19, 6) + r('glutes', 1, 75, 13, 19, 6)
    + r('hamstrings', -14, 94, 12, 34, 6) + r('hamstrings', 2, 94, 12, 34, 6)
    + calves;

  return base + (view === 'front' ? front : back)
    + `<text class="b-label" x="${cx}" y="182" text-anchor="middle">${view === 'front' ? 'Front' : 'Back'}</text>`;
}

function muscleMap(muscles) {
  const markup = `<svg viewBox="0 0 200 190" class="bodymap" role="img" aria-label="Muscles worked: ${muscles.map((m) => MUSCLE_LABEL[m] || m).join(', ')}">`
    + bodySvg('front', 52, muscles) + bodySvg('back', 148, muscles) + '</svg>';
  return h('div', { class: 'muscle-map' },
    h('div', { html: markup }),
    h('div', { class: 'muscle-chips' }, muscles.map((m, i) =>
      h('span', { class: `mchip ${i === 0 ? 'primary' : ''}`.trim() }, MUSCLE_LABEL[m] || m))));
}

// ---------------------------------------------------------------- the modal

/** Open the animation viewer for an exercise id. Resolves when it closes. */
export function openAnimation(exId) {
  const ex = EXERCISES[exId];
  const anim = animationFor(exId, ex);
  if (!anim) return Promise.resolve();

  return new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const prevFocus = document.activeElement;
    const fig = figure(anim);

    const close = () => {
      fig.stop();
      document.removeEventListener('keydown', onKey);
      wrap.classList.add('leaving');
      setTimeout(() => {
        wrap.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      }, 200);
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close animation', onclick: close }, icon('close'));
    const panel = h('div', { class: 'anim-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${ex.name} animation` },
      h('header', { class: 'anim-head' },
        h('div', { class: 'anim-titles' },
          h('div', { class: 'anim-kicker' }, 'Animation'),
          h('h2', { class: 'anim-name' }, ex.name)),
        closeBtn),
      h('div', { class: 'anim-body' },
        fig.el,
        h('section', { class: 'anim-sec' },
          h('h3', { class: 'anim-h3' }, 'Muscles worked'),
          muscleMap(anim.muscles)),
        h('section', { class: 'anim-sec' },
          h('h3', { class: 'anim-h3' }, 'How to do it'),
          h('p', { class: 'anim-cue' }, anim.cue),
          h('ol', { class: 'anim-steps' }, anim.steps.map((s) => h('li', {}, s))),
          anim.note ? h('p', { class: 'anim-note' }, anim.note) : null,
          anim.side ? h('p', { class: 'anim-note' }, 'Do all the reps on one side, then the other. Count the reps per side.') : null,
          h('div', { class: 'anim-avoid' },
            h('span', { class: 'anim-avoid-label' }, 'Avoid'),
            h('span', {}, anim.avoid)))));

    const wrap = h('div', { class: 'anim-wrap' },
      h('div', { class: 'anim-backdrop', onclick: close }),
      panel);
    document.addEventListener('keydown', onKey);
    root.append(wrap);
    closeBtn.focus({ preventScroll: true });
  });
}

/** The "Animation" button that sits under an exercise name. */
export function animationButton(exId, cls = '') {
  if (!hasAnimation(exId)) return null;
  return h('button', {
    class: `btn ghost small anim-btn ${cls}`.trim(),
    'aria-label': `Animation for ${EXERCISES[exId].name}`,
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); openAnimation(exId); },
  }, icon('play'), 'Animation');
}
