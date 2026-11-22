// The Animation viewer: an animated stick figure of the movement, a body map of the
// muscles it works, and written instructions. Opened by the "Animation" button under
// an exercise name.

import { EXERCISES } from './exercises.js';
import { animationFor, hasAnimation, muscleTiers, MUSCLE_LABEL, SEG, STAND, GROUND, VIEW } from './anim.js';
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
//
// A front and back anatomy chart. Each muscle group is an outlined region that is
// shaded by how hard the exercise works it: most, moderately or least used.
// Only one half of the body is described; the other half is the mirror image.

/** A closed, smooth outline through the given points (Catmull-Rom as cubic curves). */
function blob(pts) {
  const n = pts.length;
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d + 'Z';
}

// Shared between both views: the parts that are not a tracked muscle group.
const NEUTRAL = {
  neck: [[-9, 50], [-11, 74], [11, 74], [9, 50]],
  hand: [[-51, 262], [-63, 270], [-62, 289], [-51, 295], [-45, 282], [-47, 268]],
  pelvis: [[-4, 240], [-24, 236], [-36, 252], [-32, 276], [-7, 274]],
  knee: [[-11, 346], [-31, 343], [-33, 366], [-13, 370]],
  foot: [[-15, 420], [-32, 421], [-38, 439], [-11, 441]],
};

// The upper arm and forearm sit in the same place on both views.
const ARM = {
  upper: [[-46, 130], [-58, 140], [-61, 170], [-54, 196], [-45, 189], [-43, 150]],
  fore: [[-48, 196], [-61, 206], [-66, 236], [-59, 262], [-51, 256], [-48, 214]],
};
const DELT = [[-34, 80], [-50, 88], [-58, 108], [-52, 128], [-40, 124], [-33, 98]];

// A plain grey body under the muscle regions, so there are no gaps between them.
// It crosses the midline a little; both halves overlap and it carries no outline.
const BASE = [
  [[4, 52], [-10, 54], [-9, 68], [-28, 74], [-48, 94], [-43, 126],
    [-37, 160], [-34, 205], [-38, 248], [-35, 276], [4, 280]],
  [[-4, 256], [-30, 260], [-40, 300], [-34, 345], [-35, 398], [-30, 428], [-39, 442],
    [-9, 444], [-6, 400], [-5, 330], [-4, 286]],
  [[-34, 96], [-53, 102], [-62, 152], [-68, 212], [-65, 252], [-63, 292], [-45, 296],
    [-41, 250], [-44, 200], [-39, 150], [-32, 120]],
];

// The figure's own right side, drawn at negative x and mirrored for the other half.
const FRONT = [
  { m: null, pts: NEUTRAL.pelvis },
  { m: 'back', pts: [[-7, 58], [-26, 68], [-42, 88], [-28, 94], [-11, 78]] },        // upper trapezius
  { m: 'chest', pts: [[-5, 86], [-28, 83], [-44, 97], [-43, 120], [-26, 134], [-6, 130]] },
  { m: 'shoulders', pts: DELT },
  { m: 'core', pts: [[-24, 142], [-35, 156], [-37, 190], [-28, 220], [-22, 205], [-22, 158]] }, // obliques
  { m: 'core', pts: [[-4, 140], [-21, 141], [-23, 160], [-4, 161]] },
  { m: 'core', pts: [[-4, 166], [-22, 166], [-24, 185], [-4, 186]] },
  { m: 'core', pts: [[-4, 191], [-23, 191], [-24, 210], [-4, 211]] },
  { m: 'core', pts: [[-4, 216], [-23, 216], [-19, 242], [-4, 244]] },
  { m: 'biceps', pts: ARM.upper },
  { m: 'forearms', pts: ARM.fore },
  { m: null, pts: NEUTRAL.hand },
  { m: 'quads', pts: [[-6, 266], [-30, 264], [-39, 300], [-34, 342], [-20, 350], [-11, 318], [-7, 286]] },
  { m: null, pts: NEUTRAL.knee },
  { m: null, pts: [[-13, 368], [-29, 363], [-34, 396], [-26, 424], [-17, 420], [-12, 388]] }, // shin
  { m: null, pts: NEUTRAL.foot },
];

const BACK = [
  { m: null, pts: NEUTRAL.pelvis },
  { m: 'back', pts: [[-3, 56], [-24, 68], [-40, 90], [-25, 116], [-4, 134]] },       // trapezius
  { m: 'back', pts: [[-8, 134], [-36, 130], [-44, 162], [-27, 196], [-9, 188]] },    // latissimus dorsi
  { m: 'back', pts: [[-20, 112], [-39, 110], [-42, 128], [-25, 143], [-17, 132]] },  // infraspinatus, teres
  { m: 'back', pts: [[-2, 132], [-13, 138], [-15, 190], [-8, 222], [-2, 221]] },     // erector spinae
  { m: 'shoulders', pts: DELT },
  { m: 'triceps', pts: ARM.upper },
  { m: 'forearms', pts: ARM.fore },
  { m: null, pts: NEUTRAL.hand },
  { m: 'glutes', pts: [[-5, 230], [-29, 228], [-40, 250], [-33, 278], [-8, 277]] },
  { m: 'hamstrings', pts: [[-8, 278], [-33, 277], [-39, 312], [-31, 346], [-17, 348], [-9, 310]] },
  { m: null, pts: NEUTRAL.knee },
  { m: 'calves', pts: [[-13, 364], [-31, 361], [-35, 393], [-25, 424], [-16, 418], [-12, 383]] },
  { m: null, pts: NEUTRAL.foot },
];

/** One figure: mirrored halves plus the head and neck down the middle. */
function bodySvg(view, cx, tierOf) {
  const regions = view === 'front' ? FRONT : BACK;
  const base = BASE.map((pts) => `<path class="r base" d="${blob(pts)}"/>`).join('');
  const half = regions.map((r) => {
    const t = r.m ? tierOf(r.m) : '';
    return `<path class="r${t ? ' ' + t : ''}" d="${blob(r.pts)}"/>`;
  }).join('');
  const neck = `<path class="r" d="${blob(NEUTRAL.neck)}"/>`;
  return `<g transform="translate(${cx} 0)">`
    + neck
    + `<ellipse class="r" cx="0" cy="30" rx="20" ry="26"/>`
    + `<g>${base}</g><g transform="scale(-1 1)">${base}</g>`
    + `<g>${half}</g><g transform="scale(-1 1)">${half}</g>`
    + `<text class="b-label" x="0" y="468" text-anchor="middle">${view === 'front' ? 'Front' : 'Back'}</text>`
    + '</g>';
}

const TIER_LABEL = { most: 'Most used', mod: 'Moderately used', least: 'Least used' };

function muscleMap(tiers) {
  const tierOf = (m) => (tiers.most.includes(m) ? 'most' : tiers.mod.includes(m) ? 'mod'
    : tiers.least.includes(m) ? 'least' : '');
  const named = (list) => list.map((m) => MUSCLE_LABEL[m] || m).join(', ');
  const alt = `Muscles worked. Most used: ${named(tiers.most) || 'none'}.`
    + (tiers.mod.length ? ` Moderately used: ${named(tiers.mod)}.` : '')
    + (tiers.least.length ? ` Least used: ${named(tiers.least)}.` : '');

  const markup = `<svg viewBox="0 0 380 486" class="bodymap" role="img" aria-label="${alt}">`
    + bodySvg('front', 96, tierOf) + bodySvg('back', 284, tierOf) + '</svg>';

  const legend = h('div', { class: 'tier-legend' }, ['most', 'mod', 'least']
    .filter((t) => (t === 'most' ? tiers.most : t === 'mod' ? tiers.mod : tiers.least).length)
    .map((t) => h('span', { class: `tier-key ${t}` }, h('i', {}), TIER_LABEL[t])));

  const group = (t, list) => list.map((m) =>
    h('span', { class: `mchip ${t}` }, MUSCLE_LABEL[m] || m));

  return h('div', { class: 'muscle-map' },
    h('div', { class: 'bodymap-frame', html: markup }),
    legend,
    h('div', { class: 'muscle-chips' },
      group('most', tiers.most), group('mod', tiers.mod), group('least', tiers.least)));
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
          muscleMap(muscleTiers(exId, ex))),
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
