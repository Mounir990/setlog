# Setlog

A personal workout tracker for one user. It guides each training session, logs every set and shows progress per exercise. Vanilla HTML, CSS and JavaScript (ES modules), no framework, no build step, no backend, no accounts. Installable as a PWA and fully offline.

Status: complete (training loop, progress charts, plan editing, backup, exercise animations, offline, accessibility fallbacks).

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

All app files, the font, icons and the exercise GIFs are cached on first load, so the app works with no connection, including after the phone restarts. Data never leaves the device.

## Accessibility and comfort

- `prefers-reduced-motion`: transitions and the underline draw-on are skipped, exercise animations start paused.
- `prefers-reduced-transparency`: glass surfaces become solid. The same fallback applies when `backdrop-filter` is not supported.
- Hit areas are at least 44px, and every size lives in `css/tokens.css`.
- Haptics: 20 ms when a set is logged, a short double buzz when rest ends (on phones that support vibration).

## Exercise animations

Every exercise screen shows a looping animation; tapping it pauses it. The app looks for `media/exercises/<slug>.gif`, then `.webp`, then `.mp4`. If none exists it draws a built-in looping stick figure for that exercise (all 20 have one, see `js/stickfigures.js`), and custom exercises show a plain placeholder.

The bundled GIFs come from the public-domain Free Exercise DB photos, recoloured to the app's duotone (see `media/exercises/CREDITS.md`). To use your own, drop a file with the same slug into `media/exercises/`. For offline use, add its name to `ASSETS` in `sw.js` and bump `CACHE`.

Slugs: `pull-ups`, `slow-negatives`, `barbell-row`, `lat-pulldown`, `face-pulls`, `biceps-curls`, `dead-hang`, `push-ups`, `bench-press`, `overhead-press`, `incline-dumbbell-press`, `lateral-raises`, `triceps-pushdown`, `easy-pull-ups`, `squat`, `romanian-deadlift`, `leg-press`, `leg-curl`, `calf-raises`, `ab-wheel`.

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
scripts/build-gifs.mjs  rebuilds the exercise GIFs from public-domain photos (not part of the app)
```

## Data

Everything is stored on the device in `localStorage` under `setlog.data` (schema version 1). Clearing browser data erases history, so use Plan, then Back up data, to export a JSON file now and then. Import restores it.

## Credits

- Bricolage Grotesque, SIL Open Font License 1.1 (`fonts/OFL.txt`).
- Icons from Tabler Icons (outline), MIT licence, inlined in `js/icons.js`.
