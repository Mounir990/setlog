# Exercise animations

The GIFs in this folder are built from the exercise photos of the
[Free Exercise DB](https://github.com/yuhonas/free-exercise-db), released under the Unlicense (public domain).
Each pair of photos was recoloured to the app's night-blue duotone and cross-faded into a loop with
`scripts/build-gifs.mjs`.

`dead-hang` has no matching photo, so the app draws a built-in stick figure for it (`js/stickfigures.js`).

To use your own animation for an exercise, add `<slug>.gif`, `<slug>.webp` or `<slug>.mp4` here and it
replaces the built-in one. Add the file name to `ASSETS` in `sw.js` and bump `CACHE` if it should be cached for offline use.
