// Draws a stand-in media/exercises/<slug>.gif for exercises that have no real animation yet.
// (Real animations come from scripts/convert-gifs.mjs and win over these: same file name.)
// A grey mannequin moves between the two poses defined in js/stickfigures.js; the muscles worked are amber.
//
//   cd scripts && npm install && node make-gifs.mjs            all exercises
//   node make-gifs.mjs hammer-curl dips                         only these
//   node make-gifs.mjs --png /tmp/preview                       also write a PNG of both poses
//
// Developer tool only. The app has no build step; the GIFs are committed.

import { createCanvas } from '@napi-rs/canvas';
import gifenc from 'gifenc';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURE_SPECS, solve, dir, add } from '../js/stickfigures.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'media', 'exercises');

const W = 630;
const H = 360;
const S = 1.5; // viewBox 360x240 -> 540x360, centred in 630 wide
const BG = '#193050';
const BODY = '#e6eaf0';
const BODY_EDGE = '#b3bdcc';
const FAR = '#7e8ca1';
const FAR_EDGE = '#66748a';
const AMBER = '#ffb020';
const AMBER_EDGE = '#e58f00';
const GEAR = '#6c7e96';
const GEAR_LIGHT = '#a9b8cc';
const PLATE = '#4d607b';

// Muscles worked. Primary muscles are amber, secondary ones a fainter amber.
const MUSCLES = {
  'incline-machine-press': { primary: ['chest', 'delt'], secondary: ['arm'] },
  'cable-lateral-raise': { primary: ['delt'] },
  'bench-press-free': { primary: ['chest'], secondary: ['delt', 'arm'] },
  'bench-press-guided': { primary: ['chest'], secondary: ['delt', 'arm'] },
  'shoulder-press-machine': { primary: ['delt'], secondary: ['arm'] },
  dips: { primary: ['chest', 'arm'], secondary: ['delt'] },
  'skullcrusher-free': { primary: ['arm'] },
  'triceps-pushdown-one-hand': { primary: ['arm'] },
  'pull-ups-wide': { primary: ['lats'], secondary: ['arm'] },
  'pull-ups-narrow': { primary: ['lats', 'arm'] },
  'rowing-machine-wide': { primary: ['lats'], secondary: ['delt', 'arm'] },
  'cable-rear-delt-fly': { primary: ['delt'], secondary: ['lats'] },
  'back-extension': { primary: ['lowback', 'glute'], secondary: ['ham'] },
  'incline-biceps-curl': { primary: ['arm'] },
  'hammer-curl': { primary: ['arm', 'forearm'] },
  'standing-calf-raise': { primary: ['calf'] },
  'hex-squat': { primary: ['quad', 'glute'], secondary: ['ham'] },
  'lying-leg-curl': { primary: ['ham'], secondary: ['calf'] },
  'leg-extension': { primary: ['quad'] },
};
const PROGRAM = Object.keys(MUSCLES);

// ---- Geometry ----

const lerp = (a, b, t) => a + (b - a) * t;
const lerpP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const along = (p, q, t) => lerpP(p, q, t);

// Joints of a pose plus the far leg (drawn apart and dimmer, as in the SVG figures).
function pose(spec, p) {
  const j = solve(p);
  const far = spec.far ?? 12;
  const kn2 = add(j.hip, dir(p.thigh + far, 48));
  const ft2 = add(kn2, dir(p.shin + far * 0.5, 48));
  return { ...j, kn2, ft2, toe2: add(ft2, p.toe ?? [12, 0]) };
}
function mix(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = lerpP(a[k], b[k], t);
  return out;
}

function parseStatic(markup = '') {
  const items = [];
  for (const m of markup.matchAll(/<path class="s" d="([^"]+)"\/>/g)) {
    const toks = m[1].match(/[MLHV]|-?[\d.]+/g);
    const segs = [];
    let cur = [0, 0];
    let cmd = 'M';
    let seg = null;
    for (let i = 0; i < toks.length; ) {
      if (/[MLHV]/.test(toks[i])) cmd = toks[i++];
      if (cmd === 'H') cur = [+toks[i++], cur[1]];
      else if (cmd === 'V') cur = [cur[0], +toks[i++]];
      else cur = [+toks[i++], +toks[i++]];
      if (cmd === 'M') {
        seg = [cur];
        segs.push(seg);
        cmd = 'L';
      } else seg.push(cur);
    }
    items.push({ t: 'poly', segs });
  }
  for (const m of markup.matchAll(/<circle class="s" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)) {
    items.push({ t: 'pulley', c: [+m[1], +m[2]], r: +m[3] });
  }
  return items;
}
function parsePath(d) {
  return [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
}

// ---- Drawing ----

function capsule(ctx, p, q, r1, r2, fill, edge) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(p[0] + nx * r1, p[1] + ny * r1);
  ctx.lineTo(q[0] + nx * r2, q[1] + ny * r2);
  ctx.arc(q[0], q[1], r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(p[0] - nx * r1, p[1] - ny * r1);
  ctx.arc(p[0], p[1], r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }
}
const disc = (ctx, c, r, fill, edge, lw = 1) => {
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }
};

function drawGear(ctx, spec, j, statics) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const it of statics) {
    if (it.t === 'poly') {
      for (const seg of it.segs) {
        ctx.beginPath();
        seg.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.lineWidth = 4.2;
        ctx.strokeStyle = GEAR;
        ctx.stroke();
      }
    } else disc(ctx, it.c, it.r, GEAR_LIGHT, GEAR, 2);
  }
}

function drawFigure(ctx, spec, name, j) {
  const m = MUSCLES[name] || {};
  const prim = new Set(m.primary || []);
  const sec = new Set(m.secondary || []);
  const tint = (id) => (prim.has(id) ? 1 : sec.has(id) ? 0.5 : 0);
  const glow = (a, b, t0, t1, r0, r1, id) => {
    const k = tint(id);
    if (!k) return;
    ctx.globalAlpha = k === 1 ? 0.96 : 0.5;
    capsule(ctx, along(a, b, t0), along(a, b, t1), r0, r1, AMBER, k === 1 ? AMBER_EDGE : null);
    ctx.globalAlpha = 1;
  };
  const spot = (c, r, id) => {
    const k = tint(id);
    if (!k) return;
    ctx.globalAlpha = k === 1 ? 0.96 : 0.5;
    disc(ctx, c, r, AMBER, k === 1 ? AMBER_EDGE : null);
    ctx.globalAlpha = 1;
  };

  // Far leg
  capsule(ctx, j.hip, j.kn2, 10, 6.9, FAR, FAR_EDGE);
  capsule(ctx, j.kn2, j.ft2, 6.4, 4.5, FAR, FAR_EDGE);
  capsule(ctx, j.ft2, j.toe2, 3.6, 3.2, FAR, FAR_EDGE);
  // Near leg
  capsule(ctx, j.hip, j.kn, 11.6, 7.8, BODY, BODY_EDGE);
  capsule(ctx, j.kn, j.ft, 7.4, 4.8, BODY, BODY_EDGE);
  capsule(ctx, j.ft, j.toe, 3.8, 3.4, BODY, BODY_EDGE);
  // Torso and neck
  capsule(ctx, j.hip, j.sh, 11, 13, BODY, BODY_EDGE);
  capsule(ctx, j.sh, j.head, 4.8, 4.4, BODY, BODY_EDGE);

  // Muscles on legs and trunk
  glow(j.hip, j.kn, 0.12, 0.92, 10.4, 7, 'quad');
  glow(j.hip, j.kn, 0.12, 0.92, 10.4, 7, 'ham');
  glow(j.kn, j.ft, 0.1, 0.62, 8, 5.8, 'calf');
  spot(j.hip, 11.6, 'glute');
  glow(j.hip, j.sh, 0.04, 0.46, 10.2, 11.2, 'lowback');
  glow(j.hip, j.sh, 0.4, 0.98, 11.8, 13.2, 'chest');
  glow(j.hip, j.sh, 0.28, 0.9, 11.8, 13.2, 'lats');

  // Arm
  capsule(ctx, j.sh, j.el, 7.4, 5.9, BODY, BODY_EDGE);
  capsule(ctx, j.el, j.ha, 5.9, 4.5, BODY, BODY_EDGE);
  glow(j.sh, j.el, 0.1, 0.92, 6.8, 5.4, 'arm');
  glow(j.el, j.ha, 0.08, 0.7, 5.4, 4.5, 'forearm');
  spot(j.sh, 9.2, 'delt');
}

function drawExtras(ctx, items, front) {
  ctx.lineCap = 'round';
  for (const it of items) {
    if (it.t === 'path') {
      if (front) continue;
      const pts = parsePath(it.d);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = GEAR_LIGHT;
      ctx.stroke();
    } else if (front) {
      if (it.t === 'circle') {
        disc(ctx, it.c, it.r, PLATE, GEAR_LIGHT, 2.2);
        disc(ctx, it.c, Math.max(2.5, it.r * 0.28), GEAR_LIGHT);
      } else disc(ctx, it.c, it.r + 0.6, GEAR_LIGHT, PLATE, 1.6);
    }
  }
}

// ---- One exercise ----

const bez = (x1, y1, x2, y2) => (x) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2;
    const bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (bx < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
};
const ease = bez(0.45, 0, 0.2, 1);

function build(name) {
  const spec = FIGURE_SPECS[name];
  if (!spec) throw new Error(`No figure for ${name}`);
  const PA = pose(spec, spec.A);
  const PB = pose(spec, spec.B);
  const statics = parseStatic(spec.static);

  // Same framing as the SVG figure: fit both poses in 300 x 190 and centre them.
  const pts = [];
  for (const P of [PA, PB]) {
    for (const k of ['hip', 'sh', 'el', 'ha', 'kn', 'ft', 'toe', 'head', 'kn2', 'ft2', 'toe2']) pts.push(P[k]);
    pts.push([P.head[0] - 12, P.head[1] - 12], [P.head[0] + 12, P.head[1] + 12]);
    if (spec.extras)
      for (const it of spec.extras(P)) {
        if (it.t === 'path') pts.push(...parsePath(it.d));
        else pts.push([it.c[0] - it.r, it.c[1] - it.r], [it.c[0] + it.r, it.c[1] + it.r]);
      }
  }
  if (spec.box) pts.push([spec.box[0], spec.box[1]], [spec.box[2], spec.box[3]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(300 / (x1 - x0), 190 / (y1 - y0), 1.2);
  const tx = 180 - ((x0 + x1) / 2) * scale;
  const ty = 120 - ((y0 + y1) / 2) * scale;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const render = (u) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(S, 0, 0, S, (W - 360 * S) / 2, 0);
    ctx.transform(scale, 0, 0, scale, tx, ty);
    const j = mix(PA, PB, u);
    const extras = spec.extras ? spec.extras(j) : [];
    drawGear(ctx, spec, j, statics);
    drawExtras(ctx, extras, false);
    drawFigure(ctx, spec, name, j);
    drawExtras(ctx, extras, true);
    disc(ctx, j.ha, 4.3, BODY, BODY_EDGE);
    disc(ctx, j.head, 11.5, BODY, BODY_EDGE);
    return ctx.getImageData(0, 0, W, H).data;
  };

  // Timeline: hold A, ease to B, hold B, ease back (same timing as the in-app animation).
  const t = spec.times || [0, 0.14, 0.5, 0.64, 1];
  const dur = (spec.dur || 3.4) * 1000;
  const N = 16;
  const e = ((t[2] - t[1]) * dur) / N;
  const frames = [{ u: 0, delay: (t[1] - t[0]) * dur + e }];
  for (let k = 1; k < N; k++) frames.push({ u: ease(k / N), delay: e });
  frames.push({ u: 1, delay: e + (t[3] - t[2]) * dur });
  for (let k = 1; k < N; k++) frames.push({ u: 1 - ease(k / N), delay: e });
  return { render, frames };
}

function encode(name, pngDir) {
  const { render, frames } = build(name);
  const images = frames.map((f) => render(f.u));

  // One palette for all frames. The last entry is reserved for transparency (unchanged pixels).
  const sample = new Uint8ClampedArray(images[0].length * 6);
  [0, 6, 10, 16, 22, 26].forEach((i, n) => sample.set(images[Math.min(i, images.length - 1)], n * images[0].length));
  const palette = quantize(sample, 63, { format: 'rgb444' });
  while (palette.length < 63) palette.push([0, 0, 0]);
  palette.push([255, 0, 255]);
  const TRANS = palette.length - 1;

  const gif = GIFEncoder();
  let prev = null;
  frames.forEach((f, i) => {
    const idx = applyPalette(images[i], palette.slice(0, 63), 'rgb444');
    let out = idx;
    if (prev) {
      out = new Uint8Array(idx.length);
      for (let p = 0; p < idx.length; p++) out[p] = idx[p] === prev[p] ? TRANS : idx[p];
    }
    gif.writeFrame(out, W, H, {
      palette: i === 0 ? palette : undefined,
      delay: Math.round(f.delay / 10) * 10,
      repeat: 0,
      transparent: i > 0,
      transparentIndex: TRANS,
      dispose: 1,
    });
    prev = idx;
  });
  gif.finish();
  const bytes = gif.bytes();
  writeFileSync(join(OUT, `${name}.gif`), bytes);

  if (pngDir) {
    mkdirSync(pngDir, { recursive: true });
    const { render: r2 } = build(name);
    const c = createCanvas(W * 2, H);
    const cx = c.getContext('2d');
    for (const [n, u] of [[0, 0], [1, 1]]) {
      const d = r2(u);
      const im = cx.createImageData(W, H);
      im.data.set(d);
      cx.putImageData(im, n * W, 0);
    }
    writeFileSync(join(pngDir, `${name}.png`), c.toBuffer('image/png'));
  }
  return bytes.length;
}

// ---- Main ----

const args = process.argv.slice(2);
const pi = args.indexOf('--png');
const pngDir = pi >= 0 ? args.splice(pi, 2)[1] : null;
const names = args.length ? args : PROGRAM;
mkdirSync(OUT, { recursive: true });
let total = 0;
const made = [];
for (const name of names) {
  const size = encode(name, pngDir);
  total += size;
  made.push(`${name}.gif`);
  console.log(`${name}.gif  ${(size / 1024).toFixed(0)} KB`);
}
console.log('Run `node convert-gifs.mjs --index` to refresh media/exercises/index.json.');
