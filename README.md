# Setlog

A personal workout tracker for one user. It guides each training session, logs every set and shows progress per exercise. Vanilla HTML, CSS and JavaScript (ES modules), no framework, no build step, no backend, no accounts. Installable as a PWA and fully offline.

Status: phases 1 and 2 (training loop, progress charts, plan editing, backup) plus exercise animations. Phase 3 polish is still to come.

## Run locally

Any static server works. From this folder:

```bash
python3 -m http.server 5173
```

Open http://localhost:5173. Service workers need `localhost` or HTTPS, so open the app from there, not from a `file://` path.

## Deploy

The app is a static site: publish the repository root as it is (`netlify.toml` is included).

- Netlify: connect the repo, leave the build command empty, publish directory `.`
- Or drag the folder into https://app.netlify.com/drop

After the first deploy, open the URL on your phone and use Add to Home Screen.

Updates: the service worker fetches new files first and falls back to the cache offline, so a new deploy shows on the next open while online. If you add or rename files, add them to `ASSETS` in `sw.js` and bump `CACHE`.

## Exercise animations

Every exercise screen shows a looping animation; tapping it pauses it. The app looks for `media/exercises/<slug>.gif`, then `.webp`, then `.mp4`. If none exists it draws a built-in stick figure (currently only `dead-hang`, see `js/stickfigures.js`), and custom exercises show a plain placeholder.

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
