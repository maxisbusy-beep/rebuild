// Exercise animations: a side-view stick figure driven by joint angles, the muscles
// each exercise works, and written form instructions.
//
// A "pose" is a set of joint angles (degrees, 0 = pointing right, counter-clockwise)
// plus the hip position. The renderer interpolates between poses, so a movement is
// just two or three poses.
//
// Optional keys ending in 2 (thigh2, upper2, ...) draw a second arm/leg, used for
// split stances and one-sided work. upperLen/foreLen shorten a limb when the side
// view would otherwise make it look wrong.

export const SEG = { torso: 46, thigh: 44, shin: 40, foot: 15, upper: 26, fore: 25, neckToHead: 13, headR: 10 };
export const GROUND = 196;
export const VIEW = { w: 240, h: 212 };

// Standing, facing right.
export const STAND = {
  hipX: 118, hipY: 110, torso: 90, thigh: 272, shin: 268, foot: 352, upper: 270, fore: 268,
};

// equipAt: where the weight sits - 'hands' | 'hip' | 'shoulder' | 'none'
// ground:  draw the floor line (default true)
// prop:    static scenery - 'bench' | 'benchBehind' | 'barOverhead' | 'stepBench'
// anchor:  band anchor point [x, y] for band exercises
const ARCHETYPES = {
  // ---------------------------------------------------------------- hinge
  hinge: {
    equipAt: 'hands',
    poses: [
      { label: 'Stand tall' },
      { label: 'Hips back', hipX: 132, hipY: 112, torso: 28, thigh: 280, shin: 262, upper: 270, fore: 270 },
    ],
    steps: [
      'Stand with the feet hip-width apart, the weight in front of the thighs, knees soft.',
      'Push the hips straight back and let the chest travel down. The back stays flat.',
      'Keep the weight brushing the legs the whole way - it never drifts out in front.',
      'Stop when the hamstrings pull tight, then drive the hips forward to stand tall and squeeze the glutes.',
    ],
    avoid: 'Rounding the lower back, or turning it into a squat by bending the knees instead of the hips.',
  },
  slhinge: {
    equipAt: 'hands',
    poses: [
      { label: 'Stand on one leg', hipX: 120, thigh2: 200, shin2: 250, foot2: 300 },
      { label: 'Hinge over', hipX: 130, hipY: 108, torso: 18, thigh: 276, shin: 266, upper: 270, fore: 270, thigh2: 168, shin2: 178, foot2: 210 },
    ],
    steps: [
      'Stand on one leg with a slight bend in that knee, the weight in the opposite hand.',
      'Hinge forward from the hip and let the free leg reach straight back behind you.',
      'Keep the hips level and square to the floor - do not let the lifted hip roll open.',
      'Come back up by driving the standing hip forward. Finish all reps, then change sides.',
    ],
    avoid: 'Twisting the hips open, or rushing - balance work only pays off done slowly.',
  },
  deadliftFloor: {
    equipAt: 'hands',
    poses: [
      { label: 'Set up at the bar', hipX: 128, hipY: 138, torso: 22, thigh: 330, shin: 245, upper: 268, fore: 268 },
      { label: 'Stand up', hipX: 118, hipY: 110, torso: 88, thigh: 272, shin: 268, upper: 270, fore: 268 },
    ],
    steps: [
      'Bar over the middle of the foot, shins close to it. Grip just outside the legs.',
      'Take the slack out of the bar, brace the stomach hard and lift the chest.',
      'Push the floor away with the legs and keep the bar touching the legs the whole way up.',
      'Stand tall, then reverse the same path - hips back first, then bend the knees to set it down.',
    ],
    avoid: 'Letting the hips shoot up before the bar moves, or jerking the bar off the floor with the back.',
  },
  pullthrough: {
    equipAt: 'hands',
    anchor: [10, 184],
    poses: [
      { label: 'Hinged, band tight', hipX: 132, hipY: 112, torso: 28, thigh: 280, shin: 262, upper: 250, fore: 252 },
      { label: 'Hips snap through', hipX: 118, hipY: 110, torso: 90, thigh: 272, shin: 268, upper: 268, fore: 266 },
    ],
    steps: [
      'Anchor the band low behind you and face away from it, the band running between the legs.',
      'Step out until the band is tight, then hinge the hips back with a flat back.',
      'Snap the hips forward to stand tall and squeeze the glutes hard at the top.',
      'Let the band pull the hips back under control for the next rep. The arms just hold on.',
    ],
    avoid: 'Pulling with the arms or leaning back at the top - this is all hips.',
  },

  // ---------------------------------------------------------------- squat family
  squat: {
    equipAt: 'shoulder',
    poses: [
      { label: 'Stand tall', upper: 330, upperLen: 20, fore: 230, foreLen: 18 },
      { label: 'Sit down between the hips', hipX: 100, hipY: 142, torso: 72, thigh: 335, shin: 243, upper: 330, upperLen: 20, fore: 230, foreLen: 18 },
    ],
    steps: [
      'Feet about shoulder-width, toes turned out slightly, the weight held tight to the chest.',
      'Brace the stomach, then sit down between the hips - the knees travel out over the toes.',
      'Go as deep as you can keep a flat back, aiming for the hip crease below the knee.',
      'Drive up through the whole foot, keeping the chest up, and stand all the way tall.',
    ],
    avoid: 'Heels lifting, knees caving in, or the chest dropping toward the floor.',
  },
  splitsquat: {
    equipAt: 'hands',
    prop: 'benchBehind',
    poses: [
      { label: 'Tall split stance', thigh: 296, shin: 288, thigh2: 229, shin2: 228, foot2: 200 },
      { label: 'Back knee down', hipY: 152, torso: 86, thigh: 358, shin: 251, thigh2: 241, shin2: 160, foot2: 200 },
    ],
    steps: [
      'Set a long stance: front foot flat, rear foot behind you (up on the bench for Bulgarians).',
      'Keep the torso tall and drop straight down - the front shin stays close to vertical.',
      'Lower until the back knee is just above the floor and the front thigh is parallel.',
      'Drive through the front heel to stand. Finish every rep on one side before switching.',
    ],
    avoid: 'A short stance that pitches you forward, or pushing off the back foot to stand up.',
  },
  splitsquatFloor: {
    equipAt: 'hands',
    poses: [
      { label: 'Tall split stance', thigh: 296, shin: 288, thigh2: 243, shin2: 240, foot2: 300 },
      { label: 'Back knee down', hipY: 152, torso: 86, thigh: 358, shin: 251, thigh2: 241, shin2: 162, foot2: 250 },
    ],
    steps: [
      'Set a long stance with both feet on the floor, front foot flat, back heel up.',
      'Keep the torso tall and drop straight down - the front shin stays close to vertical.',
      'Lower until the back knee is just above the floor and the front thigh is parallel.',
      'Drive through the front heel to stand. Finish every rep on one side before switching.',
    ],
    avoid: 'A short stance that pitches you forward, or pushing off the back foot to stand up.',
  },
  revlunge: {
    equipAt: 'hands',
    poses: [
      { label: 'Stand tall' },
      { label: 'Step back and down', hipY: 150, torso: 86, thigh: 358, shin: 251, thigh2: 241, shin2: 162, foot2: 250 },
    ],
    steps: [
      'Stand tall with a weight in each hand, feet together.',
      'Step one foot straight back and lower the back knee toward the floor.',
      'Keep most of the weight on the front leg and the torso upright.',
      'Push through the front foot to bring the back foot home, then repeat on the other side.',
    ],
    avoid: 'Stepping back too short, letting the front knee drift past the toes, or leaning forward.',
  },
  stepup: {
    equipAt: 'hands',
    prop: 'stepBench',
    poses: [
      { label: 'Foot on the bench', hipX: 100, hipY: 112, thigh: 334, shin: 288, foot: 352, thigh2: 275, shin2: 260, foot2: 352 },
      { label: 'Stand up on top', hipX: 150, hipY: 88, thigh: 272, shin: 268, foot: 352, thigh2: 265, shin2: 250, foot2: 330 },
    ],
    steps: [
      'Place the whole foot on the bench - heel included - with the knee over the toes.',
      'Lean the chest slightly forward and drive through the top foot to stand up.',
      'Do not push off the floor with the bottom foot; the working leg does the work.',
      'Lower slowly and tap the floor lightly before the next rep. One side at a time.',
    ],
    avoid: 'Bouncing off the bottom foot, or a bench so high that the hip has to twist.',
  },
  calfraise: {
    equipAt: 'hands',
    poses: [
      { label: 'Heels down, full stretch' },
      { label: 'Up on the toes', hipY: 96, foot: 326 },
    ],
    steps: [
      'Stand tall with the balls of the feet on the floor, a plate or a step.',
      'Let the heels sink for a full stretch at the bottom and pause there a beat.',
      'Press up as high as you can onto the toes.',
      'Hold the top for a full second, then lower slowly. Calves respond to pauses, not speed.',
    ],
    avoid: 'Short, bouncy reps - the stretch at the bottom and the pause at the top are the exercise.',
  },
  hipthrust: {
    equipAt: 'hip',
    prop: 'bench',
    poses: [
      { label: 'Hips down', hipX: 118, hipY: 172, torso: 150, thigh: 20, shin: 280, foot: 352, upper: 340, fore: 330 },
      { label: 'Hips up, squeeze', hipX: 118, hipY: 146, torso: 175, thigh: 356, shin: 268, foot: 352, upper: 350, fore: 340 },
    ],
    steps: [
      'Upper back across the bench, feet flat, shins roughly vertical at the top.',
      'Tuck the chin, pull the ribs down and keep the stomach braced.',
      'Drive the hips up until the body is a straight line from knee to shoulder.',
      'Squeeze the glutes for a full second at the top, then lower under control.',
    ],
    avoid: 'Arching the lower back to get higher, or pushing the hips up with the quads.',
  },
  bridge: {
    equipAt: 'hip',
    poses: [
      { label: 'Hips on the floor', hipX: 118, hipY: 188, torso: 178, thigh: 40, shin: 300, foot: 352, upper: 340, fore: 330 },
      { label: 'Hips up', hipX: 118, hipY: 160, torso: 185, thigh: 10, shin: 285, foot: 352, upper: 350, fore: 340 },
    ],
    steps: [
      'Lie on your back with the shoulders on the floor, knees bent and feet flat.',
      'Pull the ribs down so the lower back is flat, not arched.',
      'Drive the hips up until the hips, knees and shoulders line up.',
      'Pause and squeeze at the top, then lower slowly to just off the floor.',
    ],
    avoid: 'Hyperextending the lower back at the top instead of finishing with the glutes.',
  },

  // ---------------------------------------------------------------- core holds
  plank: {
    equipAt: 'none',
    poses: [
      { label: 'Hold the line', hipX: 118, hipY: 150, torso: 5, thigh: 190, shin: 200, foot: 290, upper: 280, fore: 250 },
      { label: 'Hold the line', hipX: 118, hipY: 148, torso: 7, thigh: 188, shin: 198, foot: 292, upper: 280, fore: 250 },
    ],
    steps: [
      'Elbows directly under the shoulders, forearms flat, feet about hip-width.',
      'Squeeze the glutes and pull the ribs down so the hips neither sag nor pike up.',
      'Push the floor away with the forearms and hold a straight line from head to heel.',
      'Breathe steadily through the hold. End the set when the hips start to drop.',
    ],
    avoid: 'Holding your breath, or letting the hips sag - a shorter clean hold beats a long sloppy one.',
  },
  sideplank: {
    equipAt: 'none',
    poses: [
      { label: 'Hips stacked and high', hipX: 118, hipY: 150, torso: 8, thigh: 186, shin: 188, foot: 250, upper: 285, fore: 255, upper2: 95, fore2: 92 },
      { label: 'Hips stacked and high', hipX: 118, hipY: 147, torso: 10, thigh: 184, shin: 186, foot: 250, upper: 285, fore: 255, upper2: 95, fore2: 92 },
    ],
    steps: [
      'Lie on your side, elbow under the shoulder, feet stacked or staggered.',
      'Lift the hips until the body makes one straight line, top hip stacked over the bottom one.',
      'Reach the free arm to the ceiling and keep the neck long.',
      'Hold, then repeat on the other side for the same time.',
    ],
    avoid: 'Letting the hips drift back or sag toward the floor.',
  },
  deadbug: {
    equipAt: 'none',
    poses: [
      { label: 'Arms up, knees over hips', hipX: 118, hipY: 172, torso: 180, thigh: 40, shin: 100, foot: 60, upper: 95, fore: 92, thigh2: 45, shin2: 105, upper2: 92, fore2: 90 },
      { label: 'Opposite arm and leg out', hipX: 118, hipY: 172, torso: 180, thigh: 40, shin: 100, foot: 60, upper: 150, fore: 170, thigh2: 5, shin2: 356, upper2: 92, fore2: 90 },
    ],
    steps: [
      'Lie on your back, knees above the hips at 90 degrees, arms pointing at the ceiling.',
      'Press the lower back flat into the floor and keep it there for the whole set.',
      'Slowly reach one arm overhead while the opposite leg straightens toward the floor.',
      'Return under control and switch sides. Keep it slow - speed hides the mistake.',
    ],
    avoid: 'The lower back arching off the floor. Shorten the reach before you let that happen.',
  },
  hollow: {
    equipAt: 'none',
    poses: [
      { label: 'Hold', hipX: 112, hipY: 180, torso: 150, thigh: 35, shin: 25, foot: 300, upper: 160, fore: 150 },
      { label: 'Hold', hipX: 112, hipY: 178, torso: 153, thigh: 38, shin: 28, foot: 300, upper: 163, fore: 153 },
    ],
    steps: [
      'Lie on your back and press the lower back into the floor.',
      'Lift the shoulder blades and the legs just off the ground, arms long overhead.',
      'Keep the ribs down - the lower back must stay in contact with the floor.',
      'If the back lifts, bend the knees or tuck the arms in to make it easier.',
    ],
    avoid: 'Letting the lower back arch. That turns a core exercise into a back strain.',
  },

  // ---------------------------------------------------------------- horizontal press
  bench: {
    equipAt: 'hands',
    prop: 'bench',
    poses: [
      { label: 'Locked out over the chest', hipX: 118, hipY: 150, torso: 2, thigh: 196, shin: 282, foot: 352, upper: 86, fore: 90 },
      { label: 'Lower to the chest', hipX: 118, hipY: 150, torso: 2, thigh: 196, shin: 282, foot: 352, upper: 150, fore: 28 },
    ],
    steps: [
      'Lie back with the shoulder blades pinched back and down into the bench, feet planted.',
      'Start with the weights locked out over the chest, wrists stacked over the elbows.',
      'Lower under control until the weights are level with the chest, elbows about 45 degrees out.',
      'Press back up and slightly together, keeping the shoulder blades pinned to the bench.',
    ],
    avoid: 'Flaring the elbows straight out to the sides, or bouncing the weight off the chest.',
  },
  floorpress: {
    equipAt: 'hands',
    poses: [
      { label: 'Locked out', hipX: 118, hipY: 188, torso: 2, thigh: 196, shin: 300, foot: 352, upper: 86, fore: 90 },
      { label: 'Upper arms touch down', hipX: 118, hipY: 188, torso: 2, thigh: 196, shin: 300, foot: 352, upper: 150, fore: 28 },
    ],
    steps: [
      'Lie on the floor with the knees bent and the weights locked out over the chest.',
      'Lower until the backs of the upper arms touch the floor - that is your depth every rep.',
      'Pause for a beat on the floor with the elbows tucked to about 45 degrees.',
      'Press straight back up without letting the shoulders roll forward off the floor.',
    ],
    avoid: 'Using the floor as a bounce. The pause is what makes this shoulder-friendly.',
  },
  pushup: {
    equipAt: 'none',
    poses: [
      { label: 'Top, locked out', hipX: 118, hipY: 150, torso: 8, thigh: 188, shin: 192, foot: 288, upper: 282, fore: 276 },
      { label: 'Chest to the floor', hipX: 118, hipY: 172, torso: 8, thigh: 188, shin: 192, foot: 288, upper: 320, fore: 215 },
    ],
    steps: [
      'Hands just outside the shoulders, body in one straight line from head to heels.',
      'Squeeze the glutes and brace the stomach so the hips cannot sag.',
      'Lower the chest to the floor with the elbows about 45 degrees from the body.',
      'Push the floor away and lock out fully at the top before the next rep.',
    ],
    avoid: 'Hips sagging, head poking forward, or half reps that stop well above the floor.',
  },
  pike: {
    equipAt: 'none',
    poses: [
      { label: 'Hips high', hipX: 118, hipY: 118, torso: 320, thigh: 240, shin: 260, foot: 300, upper: 300, fore: 290 },
      { label: 'Head down between the hands', hipX: 118, hipY: 122, torso: 326, thigh: 240, shin: 260, foot: 300, upper: 340, fore: 235 },
    ],
    steps: [
      'Hands on the floor, feet walked in so the hips stack high over the shoulders.',
      'Keep the legs fairly straight and the back flat - this is an upside-down press.',
      'Bend the elbows and let the head travel down between the hands.',
      'Press back up until the elbows lock. Stop the set if the shoulder catches.',
    ],
    avoid: 'Letting the hips drop so it becomes a push-up, which takes the shoulders out of it.',
  },

  // ---------------------------------------------------------------- horizontal pull
  bentrow: {
    equipAt: 'hands',
    poses: [
      { label: 'Arms hanging', hipX: 132, hipY: 112, torso: 32, thigh: 282, shin: 262, upper: 268, fore: 266 },
      { label: 'Pull to the lower ribs', hipX: 132, hipY: 112, torso: 32, thigh: 282, shin: 262, upper: 228, fore: 334 },
    ],
    steps: [
      'Hinge forward to about 45 degrees with a flat back, weights hanging under the shoulders.',
      'Brace the stomach and keep the torso still for the whole set.',
      'Pull the weights to the lower ribs, driving the elbows back past the body.',
      'Squeeze the shoulder blades for a beat, then lower all the way under control.',
    ],
    avoid: 'Standing up to help the weight along, or shrugging the shoulders up to the ears.',
  },
  onearmrow: {
    equipAt: 'hands',
    prop: 'bench',
    poses: [
      { label: 'Arm hanging', hipX: 132, hipY: 124, torso: 20, thigh: 286, shin: 258, upper: 266, fore: 264, upper2: 320, fore2: 320 },
      { label: 'Elbow to the hip', hipX: 132, hipY: 124, torso: 20, thigh: 286, shin: 258, upper: 222, fore: 330, upper2: 320, fore2: 320 },
    ],
    steps: [
      'One hand and the same-side knee on the bench, back flat and parallel to the floor.',
      'Let the working arm hang straight down, shoulder blade relaxed.',
      'Pull the elbow back toward the hip - not out to the side - and pause at the top.',
      'Lower all the way until the arm is straight again. Finish the side, then swap.',
    ],
    avoid: 'Twisting the torso to lift more, or jerking the weight up with the lower back.',
  },
  chinup: {
    equipAt: 'none',
    prop: 'barOverhead',
    ground: false,
    poses: [
      { label: 'Dead hang', hipX: 118, hipY: 128, torso: 90, thigh: 300, shin: 320, foot: 350, upper: 86, fore: 90 },
      { label: 'Chin over the bar', hipX: 118, hipY: 79, torso: 90, thigh: 300, shin: 320, foot: 350, upper: 20, fore: 190 },
    ],
    steps: [
      'Start from a full dead hang with the arms straight and the shoulders active, not slack.',
      'Pull the shoulder blades down first, then drive the elbows down toward the ribs.',
      'Keep the body quiet - no kicking - and bring the chin clearly over the bar.',
      'Lower all the way back to a straight-arm hang under control. That is one rep.',
    ],
    avoid: 'Kipping or half reps. Fewer honest reps build more than many partial ones.',
  },
  pulldown: {
    equipAt: 'hands',
    anchor: [118, 14],
    poses: [
      { label: 'Arms overhead', hipX: 118, hipY: 150, torso: 88, thigh: 200, shin: 300, foot: 330, upper: 88, fore: 90 },
      { label: 'Elbows down to the ribs', hipX: 118, hipY: 150, torso: 88, thigh: 200, shin: 300, foot: 330, upper: 340, upperLen: 24, fore: 200 },
    ],
    steps: [
      'Anchor the band over the chin-up bar and kneel far enough back to feel tension.',
      'Start with the arms straight overhead and the ribs pulled down.',
      'Pull the elbows down and in toward the ribs, leading with the shoulder blades.',
      'Hold the squeeze for a beat, then let the arms travel all the way back up.',
    ],
    avoid: 'Leaning back to pull harder, or letting the band snap the arms back up.',
  },
  facepull: {
    equipAt: 'hands',
    anchor: [230, 56],
    poses: [
      { label: 'Arms extended', hipX: 118, hipY: 110, upper: 356, fore: 356 },
      { label: 'Pull to the eyebrows', hipX: 118, hipY: 110, upper: 20, fore: 120 },
    ],
    steps: [
      'Anchor the band at roughly head height and step back until it is tight.',
      'Start with the arms straight out in front, thumbs up.',
      'Pull the band toward the eyebrows, driving the elbows high and wide.',
      'Finish with the knuckles pointing back behind you, then return slowly.',
    ],
    avoid: 'Pulling to the chest with low elbows - the elbows must stay at shoulder height.',
  },
  pullapart: {
    equipAt: 'hands',
    poses: [
      { label: 'Arms straight out front', hipX: 118, hipY: 110, upper: 356, fore: 356 },
      { label: 'Pull the band apart', hipX: 118, hipY: 110, upper: 10, fore: 30, upper2: 350, fore2: 330 },
    ],
    steps: [
      'Hold the band at chest height with straight arms, hands about shoulder-width apart.',
      'Pull the ribs down and keep the shoulders away from the ears.',
      'Pull the band apart until it touches the chest, squeezing the shoulder blades together.',
      'Return slowly with the arms still straight. Light band, high reps.',
    ],
    avoid: 'Bending the elbows or shrugging - both take the work off the upper back.',
  },
  extrot: {
    equipAt: 'hands',
    anchor: [230, 112],
    poses: [
      { label: 'Forearm across the body', hipX: 118, hipY: 110, upper: 300, fore: 20 },
      { label: 'Rotate outward', hipX: 118, hipY: 110, upper: 300, fore: 110 },
    ],
    steps: [
      'Tuck the working elbow against your side with the forearm bent to 90 degrees.',
      'Hold the band so it pulls across the body, a rolled towel under the elbow if you like.',
      'Keeping the elbow glued to the ribs, rotate the forearm outward slowly.',
      'Pause at the end, then return under control. Light resistance, no pain at any point.',
    ],
    avoid: 'Letting the elbow drift off the ribs, or a band heavy enough to twist the torso.',
  },

  // ---------------------------------------------------------------- overhead press
  ohp: {
    equipAt: 'hands',
    anchor: [118, 194],
    poses: [
      { label: 'At the shoulders', hipX: 118, hipY: 110, upper: 300, upperLen: 20, fore: 60, foreLen: 20 },
      { label: 'Pressed overhead', hipX: 118, hipY: 110, upper: 86, fore: 90 },
    ],
    steps: [
      'Stand tall with the weights at shoulder height, palms facing each other.',
      'Pull the ribs down and brace the stomach so the lower back does not arch.',
      'Press up and very slightly back until the elbows lock, the weights over the ears.',
      'Lower under control to the shoulders. Stop the set if the shoulder catches or pinches.',
    ],
    avoid: 'Leaning back to press, or pressing from a wide elbow position that pinches the shoulder.',
  },
  hkpress: {
    equipAt: 'hands',
    anchor: [118, 194],
    poses: [
      { label: 'Half-kneeling, weight at the shoulder', hipX: 118, hipY: 142, torso: 88, thigh: 320, shin: 240, thigh2: 210, shin2: 300, upper: 300, upperLen: 20, fore: 60, foreLen: 20, upper2: 272, fore2: 270 },
      { label: 'Press overhead', hipX: 118, hipY: 142, torso: 88, thigh: 320, shin: 240, thigh2: 210, shin2: 300, upper: 86, fore: 90, upper2: 272, fore2: 270 },
    ],
    steps: [
      'One knee down, the other foot flat in front, hips square and tall.',
      'Hold one weight at the shoulder with a neutral grip, palm facing in.',
      'Squeeze the glute of the down leg, then press straight up without leaning.',
      'Lower slowly to the shoulder. Do all the reps, then swap knee and arm.',
    ],
    avoid: 'Side-bending away from the weight, or letting the rib cage flare up.',
  },

  // ---------------------------------------------------------------- arms
  curl: {
    equipAt: 'hands',
    anchor: [118, 194],
    poses: [
      { label: 'Arms straight' },
      { label: 'Curl up', upper: 272, fore: 50 },
    ],
    steps: [
      'Stand tall with the arms hanging straight, elbows pinned against the sides.',
      'Keep the elbows in one place for the whole rep - they are the hinge.',
      'Curl up until the forearm can go no further without the elbow moving forward.',
      'Lower for a slow count of two until the arm is completely straight.',
    ],
    avoid: 'Swinging the weight up with the back, or stopping halfway down.',
  },
  pushdown: {
    equipAt: 'hands',
    anchor: [160, 14],
    poses: [
      { label: 'Elbows bent, pinned to the ribs', hipX: 118, hipY: 110, upper: 272, fore: 55 },
      { label: 'Lock out', hipX: 118, hipY: 110, upper: 272, fore: 272 },
    ],
    steps: [
      'Anchor the band high and stand close enough that it stays tight.',
      'Pin the elbows against the ribs with the forearms up at about 90 degrees.',
      'Push the hands down until the elbows lock out, and squeeze the triceps.',
      'Let the band bring the hands up slowly - the elbows never leave the ribs.',
    ],
    avoid: 'Leaning over the band to push with the chest, or letting the elbows drift forward.',
  },
  skull: {
    equipAt: 'hands',
    prop: 'bench',
    poses: [
      { label: 'Upper arms vertical', hipX: 118, hipY: 150, torso: 2, thigh: 196, shin: 282, foot: 352, upper: 86, fore: 92 },
      { label: 'Lower beside the head', hipX: 118, hipY: 150, torso: 2, thigh: 196, shin: 282, foot: 352, upper: 86, fore: 180 },
    ],
    steps: [
      'Lie on the bench with the weights locked out and the upper arms pointing straight up.',
      'Keep the upper arms still - only the forearms move.',
      'Bend the elbows and lower the weights beside the head until the triceps stretch.',
      'Extend back to the lockout and squeeze, without letting the elbows drift back.',
    ],
    avoid: 'Turning it into a press by swinging the upper arms, or flaring the elbows wide.',
  },
  latraise: {
    equipAt: 'hands',
    anchor: [118, 194],
    poses: [
      { label: 'Arms down' },
      { label: 'Just below shoulder height', upper: 355, fore: 350 },
    ],
    steps: [
      'Light band only. Stand tall, arms down at the sides with a small bend in the elbows.',
      'Lead with the elbows and raise the arms out to the sides, thumbs turned slightly up.',
      'Stop just below shoulder height - going higher is where the shoulder gets pinched.',
      'Lower slowly. Stop the set immediately at any pop, click or pinch.',
    ],
    avoid: 'Going above shoulder height, shrugging, or using any band heavier than light.',
  },
};

// Which movement each exercise uses.
const MAP = {
  rdl: 'hinge', dbrdl: 'hinge', slrdl: 'slhinge', pullthrough: 'pullthrough',
  deadlift: 'deadliftFloor', sumodl: 'deadliftFloor',
  goblet: 'squat', frontsquat: 'squat',
  bss: 'splitsquat', splitsquat: 'splitsquatFloor', revlunge: 'revlunge', stepup: 'stepup',
  calf: 'calfraise', slcalf: 'calfraise', seatedcalf: 'calfraise',
  hipthrust: 'hipthrust', slhipthrust: 'hipthrust', glutebridge: 'bridge',
  plank: 'plank', sideplank: 'sideplank', deadbug: 'deadbug', hollow: 'hollow',
  dbbench: 'bench', floorpress: 'floorpress', dbfloorpress: 'floorpress', cgfloorpress: 'floorpress',
  pushup: 'pushup', elevpushup: 'pushup', cgpushup: 'pushup', pike: 'pike',
  bbrow: 'bentrow', dbbentrow: 'bentrow', dbrow: 'onearmrow',
  chinup: 'chinup', bandchin: 'chinup', chinneg: 'chinup', bandpulldown: 'pulldown',
  facepull: 'facepull', pullapart: 'pullapart', bandextrot: 'extrot', bandlat: 'latraise',
  dbohp: 'ohp', bandohp: 'ohp', hkpress: 'hkpress',
  dbcurl: 'curl', hammercurl: 'curl', bbcurl: 'curl', bandcurl: 'curl',
  pushdown: 'pushdown', skull: 'skull',
};

// Extra notes that only apply to one exercise, shown under the numbered steps.
const NOTES = {
  chinneg: 'Jump or step to the top position, then take a full five seconds to lower. There is no upward phase.',
  bandchin: 'Loop the band over the bar and put one knee or foot in it. The band helps most at the bottom.',
  elevpushup: 'Feet up on the bench shifts more of the load onto the shoulders and upper chest.',
  cgpushup: 'Hands under the shoulders, elbows brushing the ribs, so the triceps do most of the work.',
  cgfloorpress: 'Hands about shoulder-width with the elbows tucked in tight.',
  seatedcalf: 'Sit on the bench with the dumbbells resting on the knees and the balls of the feet on a plate.',
  slcalf: 'One leg at a time, holding something for balance. Full stretch at the bottom.',
  slhipthrust: 'One foot planted, the other leg bent and held off the floor. Keep the hips level.',
  sumodl: 'Wide stance with the toes turned out, hands inside the knees, knees pushed out over the toes.',
  frontsquat: 'Clean the bar to the shoulders, then keep the elbows high so the bar cannot roll forward.',
  goblet: 'Hold one dumbbell vertically against the chest, elbows inside the knees at the bottom.',
  bandlat: 'Right shoulder: light band only, and never above shoulder height.',
  dbohp: 'Right shoulder: palms facing each other the whole way. Stop at any catch or pinch.',
  pike: 'Right shoulder: stop the set at any pinch. Walk the feet back to make it easier.',
  bss: 'Rear foot up on the bench. Set the stance long enough that the front shin stays vertical.',
  dbrdl: 'The dumbbells slide down the thighs and stay in contact with the legs.',
  bbcurl: 'A straight bar locks the wrists. If that bothers your wrists, use dumbbells instead.',
};

// Muscle groups that only get light, supporting work in a movement. These show as
// "least used" on the body map. Anything the exercise already names outranks this.
const LIGHT = {
  hinge: ['forearms', 'core'],
  slhinge: ['forearms', 'core', 'calves'],
  deadliftFloor: ['forearms', 'core', 'quads'],
  pullthrough: ['core'],
  squat: ['core', 'calves'],
  splitsquat: ['core', 'calves', 'hamstrings'],
  splitsquatFloor: ['core', 'calves', 'hamstrings'],
  revlunge: ['core', 'calves', 'hamstrings'],
  stepup: ['core', 'calves', 'hamstrings'],
  calfraise: ['core'],
  hipthrust: ['core', 'quads'],
  bridge: ['core', 'quads'],
  plank: ['shoulders', 'glutes'],
  sideplank: ['shoulders', 'glutes'],
  deadbug: ['shoulders', 'quads'],
  hollow: ['shoulders', 'quads'],
  bench: ['core', 'shoulders'],
  floorpress: ['core', 'shoulders'],
  pushup: ['core', 'glutes'],
  pike: ['core'],
  bentrow: ['forearms', 'core', 'hamstrings'],
  onearmrow: ['forearms', 'core'],
  chinup: ['forearms', 'core'],
  pulldown: ['forearms', 'core'],
  facepull: ['forearms'],
  pullapart: ['forearms'],
  extrot: ['forearms'],
  ohp: ['core', 'chest'],
  hkpress: ['core', 'glutes'],
  curl: ['forearms', 'shoulders'],
  pushdown: ['forearms'],
  skull: ['forearms'],
  latraise: ['forearms'],
};

// Lifts where the first two muscles both drive the movement, so both read as "most used".
const TWO_PRIME = new Set([
  'rdl', 'dbrdl', 'slrdl', 'deadlift', 'sumodl', 'hipthrust', 'glutebridge', 'slhipthrust',
  'bss', 'splitsquat', 'revlunge', 'stepup', 'goblet', 'frontsquat',
  'dbbench', 'floorpress', 'dbfloorpress', 'cgfloorpress', 'pushup', 'elevpushup',
  'chinup', 'bandchin', 'chinneg', 'bbrow', 'dbrow', 'dbbentrow',
  'dbohp', 'hkpress', 'pike', 'bandohp',
]);

export const MUSCLE_LABEL = {
  quads: 'Quadriceps', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', core: 'Core', forearms: 'Forearms',
};

/**
 * How hard each muscle group works in one exercise, in three tiers.
 * The exercise's own muscle list sets the first two tiers; LIGHT adds the third.
 */
export function muscleTiers(id, ex) {
  const listed = ex.muscles;
  const primeCount = TWO_PRIME.has(id) && listed.length > 1 ? 2 : 1;
  const most = listed.slice(0, primeCount);
  const mod = listed.slice(primeCount);
  const least = (LIGHT[MAP[id]] || []).filter((m) => !listed.includes(m));
  return { most, mod, least: [...new Set(least)] };
}

/** The movement data for an exercise id, or null when there is none. */
export function animationFor(id, ex) {
  const arch = ARCHETYPES[MAP[id]];
  if (!arch || !ex) return null;
  return {
    archId: MAP[id],
    poses: arch.poses,
    equipAt: arch.equipAt || 'hands',
    prop: arch.prop || null,
    anchor: arch.anchor || null,
    ground: arch.ground !== false,
    equip: ex.equip,
    pair: ex.pair,
    side: ex.side,
    steps: arch.steps,
    avoid: arch.avoid,
    note: NOTES[id] || null,
    cue: ex.cue,
    muscles: ex.muscles,
    name: ex.name,
  };
}

export const hasAnimation = (id) => Boolean(MAP[id]);
