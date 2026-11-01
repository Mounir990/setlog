// Converts your own exercise GIFs into the small, phone-sized files the app uses.
//
//   cd scripts && npm install
//   node convert-gifs.mjs ~/Downloads        looks in <dir>/Push, <dir>/Pull, <dir>/Legs
//   node convert-gifs.mjs --index            only rewrite media/exercises/index.json
//
// Each source GIF is matched to an exercise by a word in its file name (see MATCH below), cropped to
// the moving figure, shrunk to 560 x 320 and re-encoded as <slug>.gif in media/exercises/.
// The source files stay where they are and are not part of the repository.

import gifenc from 'gifenc';
import omggif from 'omggif';
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const { GifReader } = omggif;

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'media', 'exercises');
const W = 560;
const H = 320;

// Part of the source file name -> exercise slug.
const MATCH = {
  'leg-curl-allonge': 'lying-leg-curl',
  'leg-extension-exercice': 'leg-extension',
  'extension-mollets-debout': 'standing-calf-raise',
  'souleve-de-terre-a-la-trap-bar': 'hex-squat',
  'traction-prise-serree': 'pull-ups-narrow',
  'curl-haltere-incline': 'incline-biceps-curl',
  'rowing-t-bar': 'rowing-machine-wide',
  'extension-lombaire': 'back-extension',
  'curl-haltere-prise-neutre': 'hammer-curl',
  'oiseau-a-la-poulie': 'cable-rear-delt-fly',
  'barre-front': 'skullcrusher-free',
  'dips-assiste': 'dips',
  'developpe-couche-convergent': 'bench-press-guided',
  'developpe-incline-machine': 'incline-machine-press',
  'developpe-epaules-machine': 'shoulder-press-machine',
  'extensions-concentres-des-triceps': 'triceps-pushdown-one-hand',
  'elevations-laterales-poulie': 'cable-lateral-raise',
};

const writeIndex = () => {
  const files = readdirSync(OUT).filter((f) => f.endsWith('.gif')).sort();
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ files }, null, 2) + '\n');
  console.log(`index.json: ${files.length} files`);
};

// All frames composited on white: [{ rgba, delay }], plus size.
function decode(file) {
  const reader = new GifReader(readFileSync(file));
  const { width: w, height: h } = reader;
  const canvas = new Uint8Array(w * h * 4).fill(255);
  const frames = [];
  let restore = null;
  for (let i = 0; i < reader.numFrames(); i++) {
    const info = reader.frameInfo(i);
    if (restore) restore();
    const before = info.disposal === 3 ? canvas.slice() : null;
    const patch = new Uint8Array(w * h * 4);
    reader.decodeAndBlitFrameRGBA(i, patch);
    for (let y = info.y; y < info.y + info.height; y++) {
      for (let x = info.x; x < info.x + info.width; x++) {
        const p = (y * w + x) * 4;
        if (patch[p + 3]) canvas.set(patch.subarray(p, p + 3), p);
      }
    }
    frames.push({ rgba: canvas.slice(), delay: Math.max(2, info.delay) * 10 });
    if (info.disposal === 2) {
      restore = () => {
        for (let y = info.y; y < info.y + info.height; y++)
          for (let x = info.x; x < info.x + info.width; x++) canvas.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 3);
      };
    } else if (before) restore = () => canvas.set(before);
    else restore = null;
  }
  return { frames, w, h };
}

function convert(file, slug) {
  let { frames, w, h } = decode(file);
  // Long animations: keep every other frame at double delay to stay small.
  if (frames.length > 40) {
    frames = frames.filter((_, i) => i % 2 === 0).map((f, i, a) => ({ ...f, delay: f.delay * 2 }));
  }
  // Box around everything that is not white, over all frames.
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (const f of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (f.rgba[p] < 240 || f.rgba[p + 1] < 240 || f.rgba[p + 2] < 240) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  const m = 14;
  let bw = x1 - x0 + 1 + 2 * m;
  let bh = y1 - y0 + 1 + 2 * m;
  // Same 7:4 shape as the app's animation box.
  if (bw / bh < W / H) bw = Math.round((bh * W) / H);
  else bh = Math.round((bw * H) / W);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const sx = cx - bw / 2;
  const sy = cy - bh / 2;

  const src = createCanvas(w, h);
  const sctx = src.getContext('2d');
  const dst = createCanvas(W, H);
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingQuality = 'high';
  const images = frames.map((f) => {
    const im = sctx.createImageData(w, h);
    im.data.set(f.rgba);
    sctx.putImageData(im, 0, 0);
    dctx.fillStyle = '#fff';
    dctx.fillRect(0, 0, W, H);
    dctx.drawImage(src, sx, sy, bw, bh, 0, 0, W, H);
    return dctx.getImageData(0, 0, W, H).data;
  });

  const pick = [0, 0.25, 0.5, 0.75].map((t) => images[Math.floor(t * (images.length - 1))]);
  const sample = new Uint8ClampedArray(pick[0].length * pick.length);
  pick.forEach((im, i) => sample.set(im, i * pick[0].length));
  const palette = quantize(sample, 255, { format: 'rgb444' });
  while (palette.length < 255) palette.push([0, 0, 0]);
  palette.push([255, 0, 255]);
  const TRANS = 255;
  const real = palette.slice(0, 255);

  const gif = GIFEncoder();
  let prev = null;
  images.forEach((im, i) => {
    const idx = applyPalette(im, real, 'rgb444');
    let out = idx;
    if (prev) {
      out = new Uint8Array(idx.length);
      for (let p = 0; p < idx.length; p++) out[p] = idx[p] === prev[p] ? TRANS : idx[p];
    }
    gif.writeFrame(out, W, H, {
      palette: i === 0 ? palette : undefined,
      delay: frames[i].delay,
      repeat: 0,
      transparent: i > 0,
      transparentIndex: TRANS,
      dispose: 1,
    });
    prev = idx;
  });
  gif.finish();
  const bytes = gif.bytes();
  writeFileSync(join(OUT, `${slug}.gif`), bytes);
  return { size: bytes.length, frames: frames.length };
}

const arg = process.argv[2];
if (arg === '--index') {
  writeIndex();
} else if (!arg || !existsSync(arg)) {
  console.error('Usage: node convert-gifs.mjs <folder with Push, Pull and Legs>');
  process.exit(1);
} else {
  const files = [];
  for (const group of ['Push', 'Pull', 'Legs']) {
    const gdir = join(arg, group);
    if (!existsSync(gdir)) continue;
    for (const sub of readdirSync(gdir)) {
      const sdir = join(gdir, sub);
      if (!statSync(sdir).isDirectory()) continue;
      for (const f of readdirSync(sdir)) if (f.toLowerCase().endsWith('.gif')) files.push(join(sdir, f));
    }
  }
  let total = 0;
  const used = new Set();
  for (const file of files) {
    const hit = Object.keys(MATCH).find((k) => file.toLowerCase().includes(k));
    if (!hit) {
      console.log(`skipped (no exercise): ${file.split('/').pop()}`);
      continue;
    }
    const slug = MATCH[hit];
    const r = convert(file, slug);
    used.add(slug);
    total += r.size;
    console.log(`${slug}.gif  ${(r.size / 1024).toFixed(0)} KB  ${r.frames} frames`);
  }
  console.log(`total ${(total / 1024 / 1024).toFixed(1)} MB`);
  writeIndex();
}
