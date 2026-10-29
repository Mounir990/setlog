// Builds media/exercises/<slug>.gif from the two photos of each exercise in the
// Free Exercise DB (https://github.com/yuhonas/free-exercise-db, Unlicense / public domain).
//
// Photos are recoloured to a night-blue duotone so they match the brand (no red, no green),
// then cross-faded into a looping GIF. Dev tool only, not part of the app.
//
//   npm i --no-save jpeg-js gifenc
//   node scripts/build-gifs.mjs
//
// Needs network access to raw.githubusercontent.com.

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const jpeg = require('jpeg-js');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'media', 'exercises');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const W = 360;
const H = 240;

// slug -> source exercise id. `slow` lowers over ~3 s starting from the top position (negatives).
const MAP = {
  'pull-ups': { id: 'Pullups' },
  'easy-pull-ups': { id: 'Pullups' },
  'slow-negatives': { id: 'Pullups', slow: true },
  'barbell-row': { id: 'Bent_Over_Barbell_Row' },
  'lat-pulldown': { id: 'V-Bar_Pulldown' },
  'face-pulls': { id: 'Face_Pull' },
  'biceps-curls': { id: 'Dumbbell_Bicep_Curl' },
  'push-ups': { id: 'Pushups' },
  'bench-press': { id: 'Barbell_Bench_Press_-_Medium_Grip' },
  'overhead-press': { id: 'Standing_Military_Press' },
  'incline-dumbbell-press': { id: 'Incline_Dumbbell_Press' },
  'lateral-raises': { id: 'Side_Lateral_Raise' },
  'triceps-pushdown': { id: 'Triceps_Pushdown' },
  squat: { id: 'Barbell_Squat' },
  'romanian-deadlift': { id: 'Romanian_Deadlift' },
  'leg-press': { id: 'Leg_Press' },
  'leg-curl': { id: 'Lying_Leg_Curls' },
  'calf-raises': { id: 'Standing_Calf_Raises' },
  'ab-wheel': { id: 'Ab_Roller' },
  // dead-hang has no matching photo: the app draws a built-in stick figure for it.
};

// Duotone ramp: night blue -> petrol -> white.
const STOPS = [
  [0.0, [11, 22, 51]],
  [0.55, [26, 96, 112]],
  [1.0, [255, 255, 255]],
];
function ramp(t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return STOPS[STOPS.length - 1][1];
}

async function fetchJpeg(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return jpeg.decode(Buffer.from(await res.arrayBuffer()), { useTArray: true });
}

// Cover-crop to W x H with box averaging, then map luminance to the duotone ramp.
function toDuotone(img) {
  const scale = Math.max(W / img.width, H / img.height);
  const cw = W / scale;
  const ch = H / scale;
  const x0 = (img.width - cw) / 2;
  const y0 = (img.height - ch) / 2;
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx0 = Math.floor(x0 + x / scale);
      const sx1 = Math.max(sx0 + 1, Math.floor(x0 + (x + 1) / scale));
      const sy0 = Math.floor(y0 + y / scale);
      const sy1 = Math.max(sy0 + 1, Math.floor(y0 + (y + 1) / scale));
      let sum = 0;
      let n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const o = (Math.min(img.height - 1, yy) * img.width + Math.min(img.width - 1, xx)) * 4;
          sum += (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255;
          n++;
        }
      }
      lum[y * W + x] = sum / n;
    }
  }
  return lum;
}

function stretch(lum) {
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.floor(sorted.length * 0.98)];
  return lum.map((v) => Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))), 1.1));
}

function frame(a, b, mix) {
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const [r, g, bl] = ramp(a[i] + (b[i] - a[i]) * mix);
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = bl;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

async function build(slug, { id, slow }) {
  const [i0, i1] = await Promise.all([fetchJpeg(`${BASE}/${id}/0.jpg`), fetchJpeg(`${BASE}/${id}/1.jpg`)]);
  let a = stretch(toDuotone(i0));
  let b = stretch(toDuotone(i1));
  if (slow) [a, b] = [b, a]; // start at the top, lower slowly

  const gif = GIFEncoder();
  const steps = slow ? 8 : 3;
  const stepMs = slow ? 360 : 110;
  const holdMs = slow ? 700 : 600;
  const seq = [{ mix: 0, ms: holdMs }];
  for (let s = 1; s < steps; s++) seq.push({ mix: s / steps, ms: stepMs });
  seq.push({ mix: 1, ms: holdMs });
  // Return to the start quickly for negatives, with the same pace as the way down otherwise.
  const backSteps = slow ? 2 : steps;
  for (let s = 1; s < backSteps; s++) seq.push({ mix: 1 - s / backSteps, ms: slow ? 120 : stepMs });

  for (const { mix, ms } of seq) {
    const rgba = frame(a, b, mix);
    const palette = quantize(rgba, 32);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: ms });
  }
  gif.finish();
  const file = join(OUT, `${slug}.gif`);
  writeFileSync(file, gif.bytes());
  console.log(slug.padEnd(24), `${(gif.bytes().length / 1024).toFixed(0)} KB`);
}

const only = process.argv.slice(2);
for (const [slug, cfg] of Object.entries(MAP)) {
  if (only.length && !only.includes(slug)) continue;
  await build(slug, cfg);
}
