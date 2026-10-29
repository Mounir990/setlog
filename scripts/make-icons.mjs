// Draws the app icons (PNG) without any image library. Run: node scripts/make-icons.mjs
// Motif: a white check circle (a logged set) above the solid wavy amber line.

import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const STOPS = [
  [0.0, [0x0b, 0x16, 0x33]],
  [0.35, [0x0c, 0x2a, 0x4a]],
  [0.7, [0x0a, 0x41, 0x50]],
  [1.0, [0x0b, 0x4f, 0x4e]],
];
const AMBER = [0xff, 0xb0, 0x20];

function gradient(t) {
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

const A = (165 * Math.PI) / 180;
const DIR = [Math.sin(A), -Math.cos(A)];
const LEN = Math.abs(DIR[0]) + Math.abs(DIR[1]);

const WAVE = { x0: 0.2, x1: 0.8, y: 0.71, amp: 0.028, periods: 3, half: 0.02 };
const CIRCLE = { x: 0.5, y: 0.4, r: 0.16 };
const CHECK = [
  [0.425, 0.405],
  [0.48, 0.46],
  [0.585, 0.345],
];
const CHECK_HALF = 0.016;

const waveY = (x) => WAVE.y + WAVE.amp * Math.sin(((x - WAVE.x0) / (WAVE.x1 - WAVE.x0)) * WAVE.periods * 2 * Math.PI);
const WAVE_PTS = [];
for (let i = 0; i <= 600; i++) {
  const x = WAVE.x0 + ((WAVE.x1 - WAVE.x0) * i) / 600;
  WAVE_PTS.push([x, waveY(x)]);
}

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sample(x, y) {
  let [r, g, b] = gradient(((x - 0.5) * DIR[0] + (y - 0.5) * DIR[1]) / LEN + 0.5);
  const mix = (c, a) => {
    r += (c[0] - r) * a;
    g += (c[1] - g) * a;
    b += (c[2] - b) * a;
  };
  if (Math.hypot(x - CIRCLE.x, y - CIRCLE.y) < CIRCLE.r) mix([255, 255, 255], 1);
  if (Math.min(segDist(x, y, CHECK[0], CHECK[1]), segDist(x, y, CHECK[1], CHECK[2])) < CHECK_HALF) mix([0, 0, 0], 1);
  // Distance to the wave: check only the nearby samples of the curve.
  const centre = Math.round(((x - WAVE.x0) / (WAVE.x1 - WAVE.x0)) * 600);
  let dw = Infinity;
  for (let i = Math.max(0, centre - 30); i < Math.min(600, centre + 30); i++) {
    dw = Math.min(dw, segDist(x, y, WAVE_PTS[i], WAVE_PTS[i + 1]));
  }
  if (centre < 0) dw = Math.hypot(x - WAVE_PTS[0][0], y - WAVE_PTS[0][1]);
  if (centre > 600) dw = Math.hypot(x - WAVE_PTS[600][0], y - WAVE_PTS[600][1]);
  if (dw < WAVE.half) mix(AMBER, 1);
  return [r, g, b];
}

function render(size, ss = 4) {
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((pxl + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = ss * ss;
      const o = (py * size + pxl) * 4;
      px[o] = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
      px[o + 3] = 255;
    }
  }
  return px;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(out, name), png(size, render(size)));
  console.log('wrote', name);
}
