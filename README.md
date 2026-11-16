# Rebuild

Personal strength and conditioning tracker. An installable, offline-first web app (PWA) with no build step, no server and no tracking: all data stays in the phone's browser storage (IndexedDB).

Live app: https://maxisbusy-beep.github.io/rebuild/

## Layout

- `index.html`, `css/`, `js/`: the app (plain ES modules)
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA shell and offline cache
- `tests/`: logic tests, run with `npm test` (needs Node 20+, no packages to install)
- `tools/serve.mjs`: local preview server (`npm run serve`, then open http://localhost:8123)
- `tools/make-icons.mjs`: regenerates the icons

## Releasing

Bump the version in both `sw.js` and `js/version.js` (a test checks they match), commit and push to `main`. GitHub Pages publishes the branch root; phones pick up the new version the next time the app is opened online.
