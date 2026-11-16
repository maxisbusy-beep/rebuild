// Exercise library. Only uses: barbell + plates, dumbbells, flat bench, doorway chin-up bar,
// bands, stationary bike. No squat rack. No dips and no weighted lateral raises (right shoulder).
//
// equip: bb (barbell) | db (dumbbell) | band | bw (bodyweight)
// kind:  compound (long rest) | accessory (short rest)
// mode:  reps | amrap | time (seconds)
// inc:   kg to add when progressing (0 = "next dumbbell size" / heavier band)
// pair:  two dumbbells are used, weight is entered per dumbbell
// side:  reps are per side
// def:   default [sets, repMin, repMax] when swapped into a program

const U = true; // upper-body exercise: gets the shoulder flag

function ex(name, equip, kind, muscles, cue, swaps, def, extra = {}) {
  return {
    name, equip, kind, muscles, cue, swaps,
    def: { sets: def[0], repMin: def[1], repMax: def[2] },
    mode: 'reps', inc: equip === 'bb' ? 2.5 : 0, pair: false, side: false, upper: false,
    ...extra,
  };
}

export const EXERCISES = {
  // ---------- Lower ----------
  rdl: ex('Romanian deadlift', 'bb', 'compound', ['hamstrings', 'glutes', 'back'],
    'Soft knees, push the hips back, bar brushing the legs; stop when the hamstrings are tight.',
    ['dbrdl', 'slrdl', 'pullthrough'], [3, 8, 10], { inc: 5 }),
  bss: ex('Bulgarian split squat', 'db', 'compound', ['quads', 'glutes'],
    'Rear foot on the bench, drop straight down, drive through the front heel.',
    ['splitsquat', 'revlunge', 'stepup'], [3, 8, 10], { pair: true, side: true }),
  goblet: ex('Goblet squat', 'db', 'compound', ['quads', 'glutes'],
    'Dumbbell tight to the chest, elbows inside the knees, sit down between the hips.',
    ['frontsquat', 'splitsquat', 'stepup'], [3, 10, 12]),
  plank: ex('Plank', 'bw', 'accessory', ['core'],
    'Elbows under shoulders, squeeze glutes and ribs down; a straight line from head to heel.',
    ['sideplank', 'deadbug', 'hollow'], [3, 45, 45], { mode: 'time' }),
  deadlift: ex('Deadlift', 'bb', 'compound', ['hamstrings', 'glutes', 'back'],
    'Bar over mid-foot, brace hard, push the floor away and keep the bar against the legs.',
    ['sumodl', 'rdl', 'dbrdl'], [3, 5, 5], { inc: 5 }),
  frontsquat: ex('Front squat (from floor)', 'bb', 'compound', ['quads', 'glutes', 'core'],
    'Clean the bar to the shoulders, elbows high, chest tall, sit straight down.',
    ['goblet', 'bss', 'splitsquat'], [3, 8, 10]),
  hipthrust: ex('Hip thrust', 'bb', 'compound', ['glutes', 'hamstrings'],
    'Upper back on the bench, chin tucked, drive the hips up and pause at the top.',
    ['glutebridge', 'slhipthrust', 'pullthrough'], [3, 10, 12], { inc: 5 }),
  calf: ex('Calf raise', 'db', 'accessory', ['calves'],
    'Full stretch at the bottom, pause one second on the toes at the top.',
    ['slcalf', 'seatedcalf'], [3, 15, 15]),

  // Lower alternatives
  dbrdl: ex('Dumbbell Romanian deadlift', 'db', 'compound', ['hamstrings', 'glutes'],
    'Dumbbells slide down the thighs, hips back, flat back throughout.',
    ['rdl', 'slrdl', 'pullthrough'], [3, 8, 10], { pair: true }),
  slrdl: ex('Single-leg Romanian deadlift', 'db', 'compound', ['hamstrings', 'glutes'],
    'Hinge on one leg, hips square to the floor, reach the back heel long.',
    ['rdl', 'dbrdl'], [3, 8, 10], { side: true }),
  pullthrough: ex('Band pull-through', 'band', 'accessory', ['glutes', 'hamstrings'],
    'Face away from the anchor, hinge back, snap the hips through and squeeze.',
    ['rdl', 'glutebridge'], [3, 15, 15]),
  sumodl: ex('Sumo deadlift', 'bb', 'compound', ['hamstrings', 'glutes', 'quads', 'back'],
    'Wide stance, toes out, knees pushed over the toes, chest up as you push the floor away.',
    ['deadlift', 'rdl'], [3, 5, 5], { inc: 5 }),
  splitsquat: ex('Split squat', 'db', 'compound', ['quads', 'glutes'],
    'Both feet on the floor, long stance, back knee down to just above the floor.',
    ['bss', 'revlunge', 'stepup'], [3, 8, 10], { pair: true, side: true }),
  revlunge: ex('Reverse lunge', 'db', 'compound', ['quads', 'glutes'],
    'Step back, lower under control, push through the front foot to stand.',
    ['bss', 'splitsquat', 'stepup'], [3, 8, 10], { pair: true, side: true }),
  stepup: ex('Step-up (to bench)', 'db', 'compound', ['quads', 'glutes'],
    'Whole foot on the bench, stand up without pushing off the floor, lower slowly.',
    ['bss', 'splitsquat', 'revlunge'], [3, 8, 10], { side: true }),
  glutebridge: ex('Barbell glute bridge', 'bb', 'compound', ['glutes', 'hamstrings'],
    'Shoulders on the floor, drive the hips up, ribs down, pause at the top.',
    ['hipthrust', 'slhipthrust'], [3, 10, 12], { inc: 5 }),
  slhipthrust: ex('Single-leg hip thrust', 'bw', 'accessory', ['glutes', 'hamstrings'],
    'Back on the bench, one foot planted, keep the hips level as you drive up.',
    ['hipthrust', 'glutebridge'], [3, 10, 12], { side: true }),
  slcalf: ex('Single-leg calf raise', 'db', 'accessory', ['calves'],
    'One foot on a plate or step, full stretch, pause on the toes.',
    ['calf', 'seatedcalf'], [3, 12, 15], { side: true }),
  seatedcalf: ex('Seated calf raise', 'db', 'accessory', ['calves'],
    'Sit on the bench with dumbbells on the knees, full range, slow lowering.',
    ['calf', 'slcalf'], [3, 15, 15], { pair: true }),
  sideplank: ex('Side plank', 'bw', 'accessory', ['core'],
    'Elbow under shoulder, hips high and stacked, body in one straight line.',
    ['plank', 'deadbug'], [3, 30, 30], { mode: 'time', side: true }),
  deadbug: ex('Dead bug', 'bw', 'accessory', ['core'],
    'Lower back pressed into the floor, lower the opposite arm and leg slowly.',
    ['plank', 'hollow'], [3, 10, 10], { side: true }),
  hollow: ex('Hollow hold', 'bw', 'accessory', ['core'],
    'Lower back glued to the floor, arms and legs long and just off the ground.',
    ['plank', 'deadbug'], [3, 30, 30], { mode: 'time' }),

  // ---------- Upper ----------
  dbbench: ex('Dumbbell bench press', 'db', 'compound', ['chest', 'triceps', 'shoulders'],
    'Shoulder blades pinched back and down, elbows about 45 degrees, dumbbells over the chest.',
    ['floorpress', 'dbfloorpress', 'elevpushup'], [3, 6, 10], { pair: true, upper: U }),
  bbrow: ex('Barbell row', 'bb', 'compound', ['back', 'biceps'],
    'Hinge to about 45 degrees, pull the bar to the lower ribs, no jerking.',
    ['dbbentrow', 'dbrow'], [3, 8, 10], { upper: U }),
  chinup: ex('Chin-ups', 'bw', 'compound', ['back', 'biceps'],
    'Start from a dead hang, drive the elbows down, chin over the bar, lower under control.',
    ['bandchin', 'chinneg', 'bandpulldown'], [3, 5, null], { mode: 'amrap', upper: U }),
  facepull: ex('Band face pull', 'band', 'accessory', ['shoulders', 'back'],
    'Pull to the eyebrows, elbows high, finish with the knuckles pointing back.',
    ['pullapart', 'bandextrot'], [3, 15, 15], { upper: U }),
  dbcurl: ex('Dumbbell curl', 'db', 'accessory', ['biceps'],
    'Elbows pinned to the sides, no swinging, lower for a slow count of two.',
    ['hammercurl', 'bbcurl', 'bandcurl'], [2, 10, 12], { pair: true, upper: U }),
  dbohp: ex('Neutral-grip dumbbell overhead press', 'db', 'compound', ['shoulders', 'triceps'],
    'Palms facing each other, ribs down, press up and slightly back; stop if the shoulder catches.',
    ['hkpress', 'bandohp', 'pike'], [3, 8, 10], { pair: true, upper: U }),
  dbrow: ex('One-arm dumbbell row', 'db', 'compound', ['back', 'biceps'],
    'Hand and knee on the bench, pull the elbow to the hip, pause at the top.',
    ['dbbentrow', 'bbrow'], [3, 10, 10], { side: true, upper: U }),
  floorpress: ex('Barbell floor press', 'bb', 'compound', ['chest', 'triceps'],
    'Lie on the floor, lower until the upper arms touch down, pause, then press.',
    ['dbfloorpress', 'dbbench', 'cgfloorpress'], [3, 6, 8], { upper: U }),
  pushup: ex('Push-ups', 'bw', 'compound', ['chest', 'triceps', 'shoulders'],
    'Body in one line, elbows about 45 degrees, chest to the floor, lock out at the top.',
    ['elevpushup', 'cgpushup', 'dbfloorpress'], [3, 10, null], { mode: 'amrap', upper: U }),
  bandlat: ex('Band lateral raise (light)', 'band', 'accessory', ['shoulders'],
    'Light band only. Raise to just below shoulder height, thumbs slightly up; stop at any pop.',
    ['bandextrot', 'pullapart', 'facepull'], [3, 15, 15], { upper: U }),
  pushdown: ex('Band triceps pushdown', 'band', 'accessory', ['triceps'],
    'Band anchored high, elbows pinned to the ribs, lock out and squeeze.',
    ['cgpushup', 'skull'], [2, 12, 12], { upper: U }),

  // Upper alternatives
  dbfloorpress: ex('Dumbbell floor press', 'db', 'compound', ['chest', 'triceps'],
    'On the floor, lower until the upper arms touch down, pause, press.',
    ['floorpress', 'dbbench'], [3, 6, 10], { pair: true, upper: U }),
  cgfloorpress: ex('Close-grip floor press', 'bb', 'compound', ['triceps', 'chest'],
    'Hands shoulder-width, elbows tucked, pause on the floor each rep.',
    ['floorpress', 'dbfloorpress'], [3, 6, 8], { upper: U }),
  elevpushup: ex('Feet-elevated push-ups', 'bw', 'compound', ['chest', 'shoulders', 'triceps'],
    'Feet on the bench, body rigid, chest to the floor.',
    ['pushup', 'cgpushup'], [3, 8, null], { mode: 'amrap', upper: U }),
  cgpushup: ex('Close-grip push-ups', 'bw', 'accessory', ['triceps', 'chest'],
    'Hands under the shoulders, elbows brushing the ribs.',
    ['pushup', 'pushdown'], [3, 8, null], { mode: 'amrap', upper: U }),
  dbbentrow: ex('Dumbbell bent-over row', 'db', 'compound', ['back', 'biceps'],
    'Hinge forward with a flat back, pull both dumbbells to the hips.',
    ['bbrow', 'dbrow'], [3, 8, 10], { pair: true, upper: U }),
  bandchin: ex('Band-assisted chin-ups', 'bw', 'compound', ['back', 'biceps'],
    'Band looped over the bar and under a knee; full hang to chin over the bar.',
    ['chinup', 'chinneg', 'bandpulldown'], [3, 6, null], { mode: 'amrap', upper: U }),
  chinneg: ex('Chin-up negatives', 'bw', 'compound', ['back', 'biceps'],
    'Jump or step to the top, then lower for a slow five-second count.',
    ['chinup', 'bandchin', 'bandpulldown'], [3, 4, 6], { upper: U }),
  bandpulldown: ex('Band lat pulldown', 'band', 'accessory', ['back', 'biceps'],
    'Band over the chin-up bar, kneel, pull the elbows down to the ribs.',
    ['chinup', 'bandchin'], [3, 12, 15], { upper: U }),
  pullapart: ex('Band pull-apart', 'band', 'accessory', ['shoulders', 'back'],
    'Arms straight at chest height, pull the band apart to the chest, squeeze the shoulder blades.',
    ['facepull', 'bandextrot'], [3, 15, 20], { upper: U }),
  bandextrot: ex('Band external rotation', 'band', 'accessory', ['shoulders'],
    'Elbow tucked to the side at 90 degrees, rotate the forearm outward slowly.',
    ['facepull', 'pullapart'], [3, 15, 15], { side: true, upper: U }),
  hammercurl: ex('Hammer curl', 'db', 'accessory', ['biceps'],
    'Palms facing each other, elbows still, slow lowering.',
    ['dbcurl', 'bbcurl', 'bandcurl'], [2, 10, 12], { pair: true, upper: U }),
  bbcurl: ex('Barbell curl', 'bb', 'accessory', ['biceps'],
    'Elbows at the sides, no leaning back, full stretch at the bottom.',
    ['dbcurl', 'hammercurl', 'bandcurl'], [2, 10, 12], { upper: U }),
  bandcurl: ex('Band curl', 'band', 'accessory', ['biceps'],
    'Stand on the band, elbows pinned, squeeze hard at the top.',
    ['dbcurl', 'hammercurl'], [2, 12, 15], { upper: U }),
  hkpress: ex('Half-kneeling one-arm press', 'db', 'compound', ['shoulders', 'triceps', 'core'],
    'One knee down, neutral grip, press straight up without leaning.',
    ['dbohp', 'bandohp', 'pike'], [3, 8, 10], { side: true, upper: U }),
  bandohp: ex('Band overhead press', 'band', 'accessory', ['shoulders', 'triceps'],
    'Stand on the band, palms facing in, press up smoothly, ribs down.',
    ['dbohp', 'hkpress'], [3, 12, 15], { upper: U }),
  pike: ex('Pike push-ups', 'bw', 'compound', ['shoulders', 'triceps'],
    'Hips high, head travels down between the hands, press back up.',
    ['dbohp', 'hkpress'], [3, 6, null], { mode: 'amrap', upper: U }),
  skull: ex('Dumbbell lying triceps extension', 'db', 'accessory', ['triceps'],
    'On the bench, upper arms vertical, lower the dumbbells beside the head, extend.',
    ['pushdown', 'cgpushup'], [2, 10, 12], { pair: true, upper: U }),
};

export const MUSCLES = ['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'core'];

export const getExercise = (id) => EXERCISES[id] || null;

/** Unit shown beside a weight: per-dumbbell weights say "kg each". */
export const weightUnit = (e) => (e.pair ? 'kg each' : 'kg');

/** Step for the weight +/- buttons. */
export const weightStep = (e) => (e.equip === 'bb' ? 2.5 : 1);

/** Does this exercise have a load to record? Bands are logged by reps only. */
export const hasWeight = (e) => e.equip !== 'band' && e.mode !== 'time';
