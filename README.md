# Setlog

A personal workout tracker for one user. It guides each training session, logs every set and shows progress per exercise. Vanilla HTML, CSS and JavaScript (ES modules), no framework, no build step, no backend, no accounts. Installable as a PWA and fully offline.

Status: complete. The program is Push day, Pull day, Leg day (a rotation that ignores weekdays), with variants (Free / Guided, Cable / Free), a dropset exercise, a calf-raise superset, pull-ups, one-hand and bodyweight lifts. Old exercises stay in Progress as read-only archived entries.

The app never suggests a weight or a number of reps. You type what you lifted; Setlog records it and starts the next set from your last session's values, with a "Last time" line to compare.

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

Every exercise screen shows a looping animation: a grey mannequin with the muscles worked in amber. Tapping it pauses it. The 21 GIFs in `media/exercises/` are drawn by `scripts/make-gifs.mjs` from the same two poses per exercise as the built-in stick figures (`js/stickfigures.js`), so they are our own artwork and are cached for offline use. An exercise without a listed file falls back to the stick figure, and custom exercises show a plain placeholder.

To redraw the GIFs after changing a pose or the style:

```bash
cd scripts && npm install && node make-gifs.mjs
```

To use your own animation for an exercise instead:

1. Put `<slug>.gif` (or `.webp`, `.mp4`) in `media/exercises/`.
2. List the file name in `media/exercises/index.json`, for example `{ "files": ["pull-ups-wide.gif"] }`.
3. For offline use, add its path to `ASSETS` in `sw.js` and bump `CACHE`.

Slugs: `incline-machine-press`, `cable-lateral-raise`, `bench-press-free`, `bench-press-guided`, `shoulder-press-machine`, `dips`, `skullcrusher-cable`, `skullcrusher-free`, `triceps-pushdown-one-hand`, `pull-ups-wide`, `cable-rear-delt-fly`, `rowing-machine-wide`, `pull-ups-narrow`, `back-extension`, `incline-biceps-curl`, `hammer-curl`, `standing-calf-raise`, `seated-calf-raise`, `hex-squat`, `lying-leg-curl`, `leg-extension`.

## Program model

A plan session holds cards (`js/plan.js`). A card is a plain exercise, an exercise with variants (each variant has its own key, so history, bests and the "Last time" line are never mixed) or a superset (two parts, A and B, each with its own history; `sets` counts rounds). Target reps and rest are shown as a reference and are editable in Plan; they drive no logic. A set can carry up to three drop entries that you type yourself (they start from your last drops, or from the main weight); they are stored and shown but never count toward bests. Pull-ups log clean reps, partial reps and optional added kg; only clean reps count for records. The +/- buttons move weights by 2.5 kg and reps by 1; tap a number to type any value.

## Structure

```
index.html            app shell
css/                  tokens.css (all sizes and colors), base.css (glass, buttons), screens.css
js/main.js            boot, routes, tab bar
js/store.js           versioned JSON in localStorage, migrations
js/plan.js            default plan (editable data)
js/progression.js     prefill, bests, rotation, weekly count (all derived from logged sets)
js/rest.js            rest timer based on an end timestamp
js/router.js          hash routes on the History API
js/media.js, js/stickfigures.js   exercise animation box and built-in fallbacks
js/chart.js           line chart and sparkline
js/screens/           one file per screen (today, overview, exercise, done, progress, plan)
sw.js, manifest.webmanifest, icons/
scripts/make-icons.mjs  regenerates the app icons (not part of the app)
scripts/make-gifs.mjs   renders the exercise GIFs (developer tool, needs npm install in scripts/)
```

## Data

Everything is stored on the device in `localStorage` under `setlog.data` (schema version 3). Older data is upgraded on first open: every logged set is kept, exercises that are the same movement continue under their new key (bench press, leg curl, calf raises, pull-ups, back extension), the other old exercises appear in Progress as archived, the program is replaced by the current one, and the previous plan is kept in `archive` inside the data. Clearing browser data erases history, so use Plan, then Back up data, to export a JSON file now and then. Import restores it.

## Credits

- Bricolage Grotesque, SIL Open Font License 1.1 (`fonts/OFL.txt`).
- Icons from Tabler Icons (outline), MIT licence, inlined in `js/icons.js`.
