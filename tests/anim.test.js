// Guards the exercise animations: every exercise has one, and every pose is sane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES } from '../js/exercises.js';
import { animationFor, hasAnimation, muscleTiers, MUSCLE_LABEL, STAND, VIEW, GROUND } from '../js/anim.js';

const ids = Object.keys(EXERCISES);

test('every exercise in the library has an animation', () => {
  for (const id of ids) assert.ok(hasAnimation(id), `no animation for ${id}`);
});

test('every animation has poses, steps and an avoid line', () => {
  for (const id of ids) {
    const a = animationFor(id, EXERCISES[id]);
    assert.ok(a, `no data for ${id}`);
    assert.ok(a.poses.length >= 2, `${id}: needs at least two poses`);
    assert.ok(a.steps.length >= 3, `${id}: needs at least three steps`);
    assert.ok(a.avoid && a.avoid.length > 10, `${id}: needs an avoid line`);
    for (const p of a.poses) assert.ok(p.label, `${id}: every pose needs a label`);
  }
});

test('the two poses of a movement actually differ', () => {
  for (const id of ids) {
    const [a, b] = animationFor(id, EXERCISES[id]).poses;
    assert.notDeepEqual(a, b, `${id}: start and end poses are identical`);
  }
});

test('poses keep the figure inside the frame', () => {
  for (const id of ids) {
    for (const p of animationFor(id, EXERCISES[id]).poses) {
      const x = p.hipX ?? STAND.hipX;
      const y = p.hipY ?? STAND.hipY;
      assert.ok(x > 20 && x < VIEW.w - 20, `${id}: hipX ${x} out of frame`);
      assert.ok(y > 20 && y <= GROUND, `${id}: hipY ${y} out of frame`);
      for (const [k, v] of Object.entries(p)) {
        if (k === 'label') continue;
        assert.ok(Number.isFinite(v), `${id}: ${k} is not a number`);
      }
    }
  }
});

test('muscles named by an exercise are all known and labelled', () => {
  for (const id of ids) {
    for (const m of EXERCISES[id].muscles) {
      assert.ok(MUSCLES.includes(m), `${id}: unknown muscle ${m}`);
      assert.ok(MUSCLE_LABEL[m], `no label for muscle ${m}`);
    }
  }
});

test('band exercises have an anchor to draw the band from', () => {
  for (const id of ids) {
    const a = animationFor(id, EXERCISES[id]);
    if (a.equip !== 'band') continue;
    const between = a.archId === 'pullapart'; // the band runs hand to hand
    assert.ok(a.anchor || between, `${id}: band exercise without an anchor`);
  }
});

test('every exercise has at least one most-used muscle, and every tier is labelled', () => {
  for (const id of ids) {
    const t = muscleTiers(id, EXERCISES[id]);
    assert.ok(t.most.length >= 1, `${id}: no most-used muscle`);
    for (const m of [...t.most, ...t.mod, ...t.least]) {
      assert.ok(MUSCLE_LABEL[m], `${id}: muscle ${m} has no label`);
    }
  }
});

test('a muscle never appears in two usage tiers at once', () => {
  for (const id of ids) {
    const t = muscleTiers(id, EXERCISES[id]);
    const all = [...t.most, ...t.mod, ...t.least];
    assert.equal(all.length, new Set(all).size, `${id}: a muscle is in two tiers`);
  }
});
