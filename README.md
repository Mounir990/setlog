# Setlog

A personal workout tracker for one user. It guides each training session, logs every set and shows progress per exercise. Vanilla HTML, CSS and JavaScript (ES modules), no framework, no build step, no backend, no accounts. Installable as a PWA and fully offline.

Status: complete. The program is Push day, Pull day, Leg day (a rotation that ignores weekdays), with variants (Free / Guided, Lat pulldown / Pull-ups ...), a dropset exercise, a calf-raise superset, one-hand and bodyweight lifts. Old exercises stay in Progress as read-only archived entries.

## Run locally

Any static server works. From this folder:

```bash
python3 -m http.server 5173
```

Open http://localhost:5173. Service workers need `localhost` or HTTPS, so open the app from there, not from a `file://` path.

## Deploy

The app is a static site: publish the repository root as it is. It uses only relative paths, so it works from a subfolder such as `https://<user>.github.io/setlog/`.

- GitHub Pages (used for the live copy): repository Settings, Pages, deploy from branch `main`, folder `/ (root)`. Every push to `main` republishes in about a minute.
- Netlify: connect the repo, leave the build command empty, publish directory `.` (`netlify.toml` is included). The free plan adds a "Powered by Netlify" badge to every page.

After the first deploy, open the URL on your phone and use Add to Home Screen. Data is stored per address, so switching hosts starts with empty history; use Back up data first if you move.

Updates: the service worker fetches new files first and falls back to the cache offline, so a new deploy shows on the next open while online. If you add or rename files, add them to `ASSETS` in `sw.js` and bump `CACHE`.

## Offline

All app files, the font and the icons are cached on first load, so the app works with no connection, including after the phone restarts. Data never leaves the device.

## Accessibility and comfort

- `prefers-reduced-motion`: transitions and the underline draw-on are skipped, exercise animations start paused.
- `prefers-reduced-transparency`: glass surfaces become solid. The same fallback applies when `backdrop-filter` is not supported.
- Hit areas are at least 44px, and every size lives in `css/tokens.css`.
- Haptics: 20 ms when a set is logged, a short double buzz when rest ends (on phones that support vibration).

## Exercise animations

Every exercise screen shows a looping stick-figure animation (white lines on glass); tapping it pauses it. The figures are drawn in code from two poses per exercise (`js/stickfigures.js`), so there is nothing to download and they work offline.

To use your own animation for an exercise:

1. Put `<slug>.gif` (or `.webp`, `.mp4`) in `media/exercises/`.
2. List the file name in `media/exercises/index.json`, for example `{ "files": ["pull-ups-wide.gif"] }`.
3. For offline use, add its path to `ASSETS` in `sw.js` and bump `CACHE`.

Custom exercises you add in the app show a plain placeholder.

Slugs: `incline-machine-press`, `cable-lateral-raise`, `bench-press-free`, `bench-press-guided`, `shoulder-press-machine`, `dips`, `skullcrusher-cable`, `skullcrusher-free`, `triceps-pushdown-one-hand`, `lat-pulldown-wide`, `pull-ups-wide`, `cable-rear-delt-fly`, `t-bar-row`, `rowing-machine-wide`, `lat-pulldown-narrow`, `pull-ups-narrow`, `back-extension-free`, `back-extension-machine`, `incline-biceps-curl`, `hammer-curl`, `standing-calf-raise`, `seated-calf-raise`, `hex-squat`, `lying-leg-curl`, `leg-extension`.

## Program model

A plan session holds cards (`js/plan.js`). A card is a plain exercise, an exercise with variants (each variant has its own key, so history, bests and "Try X" are never mixed) or a superset (two parts, A and B, each with its own history; `sets` counts rounds). A set can carry up to three drop entries (about 20% lighter each) that are stored and shown but never count toward progression or bests. Progression is double progression with the 10-day gap rule; the strict pull-up ladder (2 x 4, 2 x 5, 2 x 6, then +2.5 kg at 2 x 4) applies to the pull-ups variants.

## Structure

```
index.html            app shell
css/                  tokens.css (all sizes and colors), base.css (glass, buttons), screens.css
js/main.js            boot, routes, tab bar
js/store.js           versioned JSON in localStorage, migrations
js/plan.js            default plan (editable data)
js/progression.js     prefill, hints, bests, rotation, weekly count (all derived from logged sets)
js/rest.js            rest timer based on an end timestamp
js/router.js          hash routes on the History API
js/media.js, js/stickfigures.js   exercise animation box and built-in fallbacks
js/chart.js           line chart and sparkline
js/screens/           one file per screen (today, overview, exercise, done, progress, plan)
sw.js, manifest.webmanifest, icons/
scripts/make-icons.mjs  regenerates the app icons (not part of the app)
```

## Data

Everything is stored on the device in `localStorage` under `setlog.data` (schema version 2). Version 1 data (the old Upper back / Upper front / Legs program) is upgraded on first open: history is kept, bench press, lat pulldown, leg curl, calf raises and pull-ups continue under their new keys, the other old exercises are archived, and the previous plan is kept in `archive` inside the data. Clearing browser data erases history, so use Plan, then Back up data, to export a JSON file now and then. Import restores it.

## Credits

- Bricolage Grotesque, SIL Open Font License 1.1 (`fonts/OFL.txt`).
- Icons from Tabler Icons (outline), MIT licence, inlined in `js/icons.js`.
