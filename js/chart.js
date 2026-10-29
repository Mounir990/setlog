// Line chart: one amber line, round joins, ring-edged end dot, faint horizontal gridlines only.

import { h } from './dom.js';
import { shortDate } from './format.js';

const W = 320;
const H = 120;
const PAD = { l: 4, r: 12, t: 14, b: 10 };

const round1 = (n) => String(Math.round(n * 10) / 10);

export function lineChart(points, ariaLabel) {
  if (!points.length) {
    return h('div', { class: 'chart-empty' }, 'No sessions in this period.');
  }
  const vs = points.map((p) => p.v);
  const vmin = Math.min(...vs);
  const vmax = Math.max(...vs);
  const pad = Math.max((vmax - vmin) * 0.25, Math.abs(vmax) * 0.03, 0.5);
  const lo = vmin - pad;
  const hi = vmax + pad;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t) => (t1 === t0 ? (W - PAD.r + PAD.l) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const grid = [0, 1, 2]
    .map((i) => {
      const gy = PAD.t + (i * (H - PAD.t - PAD.b)) / 2;
      const val = hi - (i * (hi - lo)) / 2;
      return `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="rgba(255,255,255,0.12)"/><text x="${PAD.l}" y="${gy - 3}" fill="rgba(255,255,255,0.45)" font-size="9">${round1(val)}</text>`;
    })
    .join('');
  const last = points[points.length - 1];
  const line =
    points.length > 1
      ? `<polyline points="${points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="#FFB020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${ariaLabel}">${grid}${line}<circle cx="${x(last.t).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4.5" fill="#FFB020" stroke="#fff" stroke-width="1.5"/></svg>`;

  const dates = points.length > 1 ? [t0, (t0 + t1) / 2, t1] : [t0];
  return h(
    'div',
    { class: 'chart' },
    h('div', { html: svg }),
    h('div', { class: 'chart-x' }, dates.map((t) => h('span', {}, shortDate(t)))),
  );
}

// Tiny trend line for list rows: last 8 values, no axes.
export function sparkline(values) {
  const v = values.slice(-8);
  if (v.length < 2) return h('span', { class: 'spark-empty' });
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = v
    .map((n, i) => `${1 + (i * 34) / (v.length - 1)},${hi === lo ? 6 : 11 - ((n - lo) / (hi - lo)) * 10}`)
    .join(' ');
  return h('span', {
    class: 'spark',
    html: `<svg viewBox="0 0 36 12" width="36" height="12" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#FFB020" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  });
}
