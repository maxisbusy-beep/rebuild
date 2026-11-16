# Rebuild

Personal strength and conditioning tracker. An installable, offline-first web app (PWA) with no build step, no server and no tracking: all data stays in the phone's browser storage (IndexedDB).

Live app: https://maxisbusy-beep.github.io/rebuild/

## What it does

- **Today**: next workout in the rotation (Lower A, Upper A, Lower B, Upper B), bike or rest instead, weekly rings, protein tally, creatine, mobility and sleep check-ins.
- **Workout**: per-set weight, reps and reps in reserve, one-tap confirm, automatic rest timer with vibration, screen kept awake, shoulder flag on upper-body exercises, swaps limited to the available equipment.
- **Progression**: double progression, stall detection (10% drop after three flat sessions), two ramp-in weeks, deload suggested every sixth week.
- **Log**: lifting and bike history, bike trends.
- **Progress**: per-exercise strength charts, sessions per week, weekly volume per muscle group, training calendar, records, shoulder report.
- **Body**: weekly weight, waist and photo check-ins with 4-week moving averages and eating guidance.
- **Settings**: profile, rest timers, program editor, deload control, backup export and import.

## Layout

- `index.html`, `css/`, `js/`: the app (plain ES modules). `js/views/` holds the screens; the other `js/` files are logic with no DOM access.
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA shell and offline cache
- `tests/`: logic tests, run with `npm test` (needs Node 20+, no packages to install)
- `tools/serve.mjs`: local preview server (`npm run serve`, then open http://localhost:8123)
- `tools/make-icons.mjs`: regenerates the icons

## Releasing

Bump the version in both `sw.js` and `js/version.js` (a test checks they match) and add any new file to the `PRECACHE` list in `sw.js` (a test checks that too). Commit and push to `main`. GitHub Pages publishes the branch root; phones pick up the new version the next time the app is opened online.
