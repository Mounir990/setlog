// Built-in looping stick-figure animations, used when media/exercises/<slug>.(gif|webp|mp4) is missing.
// White lines on glass. A small rig builds each figure from two poses (angles in degrees) and animates between them.
//
// Angles are measured from straight down, clockwise: 0 = down, 90 = toward the right (the figure faces right),
// 180 = up, -90 = toward the left.

const rad = (d) => (d * Math.PI) / 180;
const dir = (a, len) => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];

// Segment lengths.
const TORSO = 62;
const UARM = 34;
const FARM = 32;
const THIGH = 48;
const SHIN = 48;
const NECK = 26;
const HEAD_R = 12;

// Joints of one pose. Anchored by the foot, the hand or the hip.
function solve(p) {
  let hip;
  let sh;
  let el;
  let ha;
  let kn;
  let ft;
  if (p.hand) {
    ha = p.hand;
    el = sub(ha, dir(p.farm, FARM));
    sh = sub(el, dir(p.uarm, UARM));
    hip = sub(sh, dir(p.torso, TORSO));
    kn = add(hip, dir(p.thigh, THIGH));
    ft = add(kn, dir(p.shin, SHIN));
  } else {
    if (p.foot) {
      ft = p.foot;
      kn = sub(ft, dir(p.shin, SHIN));
      hip = sub(kn, dir(p.thigh, THIGH));
    } else {
      hip = p.hip;
      kn = add(hip, dir(p.thigh, THIGH));
      ft = add(kn, dir(p.shin, SHIN));
    }
    sh = add(hip, dir(p.torso, TORSO));
    el = add(sh, dir(p.uarm, UARM));
    ha = add(el, dir(p.farm, FARM));
  }
  const head = add(sh, dir(p.head ?? p.torso, NECK));
  const toe = add(ft, p.toe ?? [12, 0]);
  return { hip, sh, el, ha, kn, ft, head, toe };
}

const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;
const poly = (pts) => 'M' + pts.map(pt).join(' L');

// Everything that moves, as a flat list: [{ t: 'path', d }, { t: 'circle', c, r }, { t: 'dot', c, r }].
function parts(spec, pose) {
  const j = solve(pose);
  // The far leg is drawn a little apart and dimmer so a side view does not collapse into one line.
  const kn2 = add(j.hip, dir(pose.thigh + (spec.far ?? 12), THIGH));
  const ft2 = add(kn2, dir(pose.shin + (spec.far ?? 12) * 0.5, SHIN));
  const list = [
    { t: 'path', far: true, d: poly([j.hip, kn2, ft2, add(ft2, pose.toe ?? [12, 0])]) },
    { t: 'path', d: poly([j.hip, j.sh]) },
    { t: 'path', d: poly([j.sh, j.el, j.ha]) },
    { t: 'path', d: poly([j.hip, j.kn, j.ft, j.toe]) },
    { t: 'circle', c: j.head, r: HEAD_R },
  ];
  if (spec.extras) list.push(...spec.extras(j));
  return { list, j };
}

function bounds(spec, listA, listB) {
  const xs = [];
  const ys = [];
  for (const list of [listA, listB]) {
    for (const it of list) {
      if (it.t === 'path') {
        for (const m of it.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
          xs.push(+m[1]);
          ys.push(+m[2]);
        }
      } else {
        xs.push(it.c[0] - it.r, it.c[0] + it.r);
        ys.push(it.c[1] - it.r, it.c[1] + it.r);
      }
    }
  }
  if (spec.box) {
    xs.push(spec.box[0], spec.box[2]);
    ys.push(spec.box[1], spec.box[3]);
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const SPLINE = '0 0 1 1;0.45 0 0.2 1;0 0 1 1;0.45 0 0.2 1';

function animate(attr, a, b, spec) {
  const t = spec.times || [0, 0.14, 0.5, 0.64, 1];
  return `<animate attributeName="${attr}" values="${a};${a};${b};${b};${a}" keyTimes="${t.join(';')}" keySplines="${SPLINE}" calcMode="spline" dur="${spec.dur || 3.4}s" repeatCount="indefinite"/>`;
}

// mode: 'animated' (default) or 'A' / 'B' for a single static pose.
export function renderRig(spec, mode = 'animated') {
  const a = parts(spec, spec.A);
  const b = parts(spec, spec.B);
  const [x0, y0, x1, y1] = bounds(spec, a.list, b.list);
  const scale = Math.min(300 / (x1 - x0), 190 / (y1 - y0), 1.2);
  const tx = 180 - ((x0 + x1) / 2) * scale;
  const ty = 120 - ((y0 + y1) / 2) * scale;

  const body = a.list
    .map((it, i) => {
      const o = b.list[i];
      const still = mode === 'B' ? o : it;
      const ani = (attr, va, vb) => (mode === 'animated' ? animate(attr, va, vb, spec) : '');
      if (it.t === 'path') {
        return `<path class="l${it.far ? ' far' : ''}" d="${still.d}">${ani('d', it.d, o.d)}</path>`;
      }
      const cls = it.t === 'dot' ? 'f' : 'l';
      return `<circle class="${cls}" cx="${f1(still.c[0])}" cy="${f1(still.c[1])}" r="${it.r}">${ani('cx', f1(it.c[0]), f1(o.c[0]))}${ani('cy', f1(it.c[1]), f1(o.c[1]))}</circle>`;
    })
    .join('');

  return `<svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <style>.l{fill:none;stroke:#fff;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.far{stroke-opacity:.5}.f{fill:#fff}.s{fill:none;stroke:rgba(255,255,255,.45);stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke}</style>
    <g transform="translate(${f1(tx)} ${f1(ty)}) scale(${f1(scale * 100) / 100})">${spec.static || ''}${body}</g>
  </svg>`;
}

// ---- Props ----

const floor = (x0, x1, y) => `<path class="s" d="M${x0} ${y} H${x1}"/>`;
const ring = (c, r = 14) => ({ t: 'circle', c, r });
const dot = (c, r = 6) => ({ t: 'dot', c, r });
const line = (p, q) => ({ t: 'path', d: poly([p, q]) });
const bar = (x0, x1, y) => `<path class="s" d="M${x0} ${y} H${x1}"/>`;

// Standing pose helper.
const stand = { foot: [160, 224], thigh: 0, shin: 0, torso: 178, uarm: 16, farm: 8 };

// ---- Exercises ----

const SPECS = {
  squat: {
    static: floor(70, 270, 226),
    A: { ...stand, torso: 176, uarm: 40, farm: 205 },
    B: { foot: [160, 224], thigh: 80, shin: -32, torso: 148, uarm: 40, farm: 205 },
    extras: (j) => [ring([j.sh[0] - 17, j.sh[1] + 2], 10)],
  },
  'romanian-deadlift': {
    static: floor(70, 270, 226),
    A: { ...stand },
    B: { foot: [150, 224], thigh: 12, shin: -8, torso: 108, uarm: 8, farm: 0 },
    extras: (j) => [ring(j.ha, 13)],
  },
  'leg-press': {
    static: `<path class="s" d="M70 210 L150 112"/><path class="s" d="M96 196 L130 226"/>`,
    A: { hip: [104, 176], thigh: 140, shin: 55, torso: 225, uarm: 120, farm: 100 },
    B: { hip: [104, 176], thigh: 122, shin: 122, torso: 225, uarm: 120, farm: 100 },
    extras: (j) => [line(add(j.ft, [-9, 12]), add(j.ft, [9, -12]))],
  },
  'leg-curl': {
    static: `<path class="s" d="M66 196 H230"/><path class="s" d="M84 196 V224 M212 196 V224"/>`,
    A: { hip: [150, 182], thigh: 90, shin: 90, torso: 270, uarm: 255, farm: 255, toe: [0, 10] },
    B: { hip: [150, 182], thigh: 90, shin: 205, torso: 270, uarm: 255, farm: 255, toe: [0, 10] },
    extras: (j) => [ring(add(j.ft, [0, -4]), 6)],
  },
  'calf-raises': {
    static: floor(70, 270, 228) + `<path class="s" d="M118 228 V222 H202 V228"/>`,
    A: { ...stand, foot: [160, 222], toe: [12, 0] },
    B: { ...stand, foot: [160, 208], toe: [8, 14] },
    extras: (j) => [dot(j.ha, 6)],
  },
  'ab-wheel': {
    static: floor(60, 300, 210),
    A: { hip: [135, 150], thigh: 0, shin: -90, torso: 120, uarm: 12, farm: 10, toe: [-10, 0] },
    B: { hip: [135, 150], thigh: 0, shin: -90, torso: 98, uarm: 52, farm: 48, toe: [-10, 0] },
    extras: (j) => [ring(add(j.ha, [0, 12]), 12)],
  },
  'push-ups': {
    static: floor(40, 300, 226),
    A: { hand: [230, 222], farm: 0, uarm: 0, torso: 116, thigh: -64, shin: -64, toe: [-6, 4] },
    B: { hand: [230, 222], farm: 70, uarm: -60, torso: 100, thigh: -80, shin: -80, toe: [-6, 4] },
  },
  'bench-press': {
    static: `<path class="s" d="M118 190 H262"/><path class="s" d="M138 190 V224 M244 190 V224"/>` + floor(60, 300, 226),
    A: { hip: [150, 180], thigh: -125, shin: -30, torso: 90, uarm: -100, farm: 140 },
    B: { hip: [150, 180], thigh: -125, shin: -30, torso: 90, uarm: 180, farm: 180 },
    extras: (j) => [ring(j.ha, 11)],
  },
  'overhead-press': {
    static: floor(70, 270, 226),
    A: { ...stand, uarm: 30, farm: 192 },
    B: { ...stand, uarm: 180, farm: 180 },
    extras: (j) => [ring(j.ha, 11)],
  },
  'incline-dumbbell-press': {
    static: `<path class="s" d="M70 196 L126 150 M126 150 L148 196 H210"/>` + floor(60, 270, 226),
    A: { hip: [150, 186], thigh: 82, shin: 8, torso: 222, uarm: 80, farm: 205 },
    B: { hip: [150, 186], thigh: 82, shin: 8, torso: 222, uarm: 190, farm: 190 },
    extras: (j) => [dot(j.ha, 7)],
  },
  'lateral-raises': {
    static: floor(70, 270, 226),
    A: { ...stand, uarm: 8, farm: 8 },
    B: { ...stand, uarm: 85, farm: 95 },
    extras: (j) => [dot(j.ha, 7)],
  },
  'biceps-curls': {
    static: floor(70, 270, 226),
    A: { ...stand },
    B: { ...stand, farm: 168 },
    extras: (j) => [dot(j.ha, 7)],
  },
  'triceps-pushdown': {
    static: floor(70, 270, 226) + `<circle class="s" cx="200" cy="26" r="7"/>`,
    A: { ...stand, torso: 172, uarm: 6, farm: 95 },
    B: { ...stand, torso: 172, uarm: 6, farm: 8 },
    extras: (j) => [line([200, 26], j.ha), dot(j.ha, 5)],
  },
  'face-pulls': {
    static: floor(70, 300, 226) + `<circle class="s" cx="300" cy="82" r="7"/>`,
    A: { ...stand, torso: 176, uarm: 78, farm: 88 },
    B: { ...stand, torso: 176, uarm: 250, farm: 112 },
    extras: (j) => [line([300, 82], j.ha), dot(j.ha, 5)],
  },
  'lat-pulldown': {
    static: `<path class="s" d="M150 196 H216"/><path class="s" d="M150 196 V224"/>` + floor(60, 300, 226) + `<circle class="s" cx="188" cy="14" r="7"/>`,
    A: { hip: [150, 188], thigh: 82, shin: 4, torso: 172, uarm: 165, farm: 172 },
    B: { hip: [150, 188], thigh: 82, shin: 4, torso: 166, uarm: 8, farm: 160 },
    extras: (j) => [line([188, 14], j.ha), dot(j.ha, 5)],
  },
  'barbell-row': {
    static: floor(70, 270, 226),
    A: { foot: [150, 224], thigh: 12, shin: -8, torso: 108, uarm: 0, farm: 0 },
    B: { foot: [150, 224], thigh: 12, shin: -8, torso: 108, uarm: 238, farm: 168 },
    extras: (j) => [ring(j.ha, 12)],
  },
  'pull-ups': {
    static: `<path class="s" d="M118 34 H182"/>`,
    A: { hand: [150, 34], farm: 180, uarm: 180, torso: 180, thigh: 0, shin: -112, toe: [-9, 6] },
    B: { hand: [150, 34], farm: 165, uarm: -10, torso: 180, thigh: 0, shin: -112, toe: [-9, 6] },
  },
  'easy-pull-ups': null, // same figure as pull-ups
  'slow-negatives': null, // pull-ups, lowered slowly
};

SPECS['easy-pull-ups'] = SPECS['pull-ups'];
// Negatives start at the top and lower slowly.
SPECS['slow-negatives'] = {
  ...SPECS['pull-ups'],
  A: SPECS['pull-ups'].B,
  B: SPECS['pull-ups'].A,
  dur: 6,
  times: [0, 0.08, 0.84, 0.9, 1],
};

// Dead hang is a front view: arms straight, then the shoulders pull down a little and relax.
const deadHang = `
  <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <style>
      .l { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
      .f { fill: #fff; }
      .body { animation: hang 3.2s ease-in-out infinite alternate; }
      @keyframes hang { from { transform: translateY(0); } to { transform: translateY(-9px); } }
      .paused * { animation-play-state: paused !important; }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
    </style>
    <defs><clipPath id="below-bar"><rect x="0" y="36" width="360" height="204"/></clipPath></defs>
    <path class="l" d="M92 30 H268"/>
    <g clip-path="url(#below-bar)">
      <g class="body">
        <path class="l" d="M132 0 L158 92 M228 0 L202 92"/>
        <path class="l" d="M158 92 H202"/>
        <circle class="l" cx="180" cy="68" r="15"/>
        <path class="l" d="M180 92 V158"/>
        <path class="l" d="M180 158 L168 222 M180 158 L192 222"/>
      </g>
    </g>
    <circle class="f" cx="132" cy="33" r="6"/><circle class="f" cx="228" cy="33" r="6"/>
  </svg>`;

export const FIGURES = Object.fromEntries([
  ...Object.entries(SPECS).map(([slug, spec]) => [slug, () => renderRig(spec)]),
  ['dead-hang', () => deadHang],
]);

// For the dev preview page only.
export const FIGURE_SPECS = SPECS;
