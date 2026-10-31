# Your own exercise animations

Setlog draws a built-in stick figure for every exercise. To use your own animation instead:

1. Put `<slug>.gif`, `<slug>.webp` or `<slug>.mp4` in this folder (for example `pull-ups-wide.gif`).
2. List the file name in `index.json`:

   ```json
   { "files": ["pull-ups-wide.gif"] }
   ```

The slugs are listed in the main README. For offline use, also add the file path to `ASSETS` in `sw.js` and bump `CACHE`.
