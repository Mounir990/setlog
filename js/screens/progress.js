// Screens 8, 9 and 10: Progress, exercise progress (chart) and the bodyweight sheet.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { data, notify, persist } from '../store.js';
import { go, back } from '../router.js';
import { num, bestShort, dayLabel, sessionSummary, goalLabel } from '../format.js';
import {
  weekCount,
  trackedExercises,
  findExercise,
  metricSeries,
  metricLabel,
  bestFor,
  historyFor,
  pullupGoal,
  latestBodyweight,
  DAY,
} from '../progression.js';
import { iconButton, segmented, sheet, bigStepper } from '../ui.js';
import { lineChart, sparkline } from '../chart.js';

const DEFAULT_BODYWEIGHT = 77;

function rowValue(ex, series, best) {
  switch (ex.kind) {
    case 'pullup':
      return `${num(best)} clean`;
    case 'weighted':
      return best ? `${num(best)} kg` : '-';
    case 'time':
      return `${num(best)} s`;
    default:
      // Push-ups show the total of the latest session; other rep exercises show the best set.
      return ex.key === 'push-ups' ? `${num(series[series.length - 1].v)} reps` : `${num(best)} reps`;
  }
}

export function progress() {
  const d = data();
  const count = weekCount(d);
  const tracked = trackedExercises(d);
  const bw = latestBodyweight(d);

  const rows = tracked.map((ex) => {
    const series = metricSeries(d, ex);
    const best = bestFor(d, ex);
    return h(
      'button',
      { class: 'row', type: 'button', onclick: () => go(`/progress/ex/${encodeURIComponent(ex.key)}`) },
      h('span', { class: 'name' }, ex.name),
      h('span', { class: 'end' }, sparkline(series.map((p) => p.v)), h('span', { class: 'muted sec value' }, series.length ? rowValue(ex, series, best) : '-')),
    );
  });

  const bodyRow = h(
    'div',
    { class: 'row split' },
    h(
      'button',
      { class: 'row-main', type: 'button', onclick: () => go('/progress/ex/bodyweight') },
      h('span', { class: 'name' }, 'Bodyweight'),
      h('span', { class: 'muted sec' }, bw ? `${num(bw.kg)} kg` : '-'),
    ),
    h('button', { class: 'row-plus', type: 'button', 'aria-label': 'Log bodyweight', onclick: () => go('/progress/bodyweight') }, icon('plus')),
  );

  const segs = [0, 1, 2].map((i) => h('span', { class: i < count ? 'on' : '' }));
  const el = h(
    'main',
    { class: 'screen has-tabs' },
    h('h1', { class: 'title' }, 'Progress'),
    h(
      'section',
      { class: 'glass card compact' },
      h('div', { class: 'between' }, h('span', {}, 'This week'), h('span', { class: 'amber medium' }, `${Math.min(count, 3)} of 3 sessions`)),
      h('div', { class: 'week wide' }, segs),
    ),
    tracked.length ? null : h('p', { class: 'stub' }, 'Finish a session to see trends here.'),
    h('section', { class: 'glass list' }, rows, bodyRow),
  );
  return { el };
}

// ---- Bodyweight sheet ----

export function bodyweightSheet(params, ctx) {
  const base = progress(params, ctx);
  const d = data();
  const last = latestBodyweight(d);
  let kg = last ? last.kg : DEFAULT_BODYWEIGHT;

  let sh;
  const save = () => {
    const now = Date.now();
    const today = new Date(now).toDateString();
    const entries = d.bodyweight;
    const sameDay = entries.find((e) => new Date(e.date).toDateString() === today);
    if (sameDay) {
      sameDay.kg = kg;
      sameDay.date = now;
    } else {
      entries.push({ date: now, kg });
    }
    entries.sort((a, b) => a.date - b.date);
    persist();
    sh.close();
  };

  const content = h(
    'div',
    { class: 'sheet-body' },
    h('div', { class: 'label center-text' }, 'kg'),
    bigStepper({ label: 'bodyweight', value: kg, step: 0.1, min: 20, max: 400, format: (n) => n.toFixed(1), onChange: (v) => (kg = v) }),
    h('button', { class: 'btn-primary', type: 'button', onclick: save }, 'Save'),
  );
  sh = sheet({ title: 'Bodyweight', content, animate: ctx.pathChanged, onClose: () => back('/progress') });
  return { el: base.el, overlay: sh.nodes, onEscape: sh.close };
}

// ---- Exercise progress ----

let period = '3m';
const PERIODS = [
  { value: '4w', label: '4 weeks', days: 28 },
  { value: '3m', label: '3 months', days: 92 },
  { value: 'all', label: 'All', days: Infinity },
];

function filterPeriod(points) {
  const days = PERIODS.find((p) => p.value === period).days;
  const cutoff = Date.now() - days * DAY;
  return points.filter((p) => p.t >= cutoff);
}

function periodSwitch() {
  return segmented({
    label: 'Period',
    options: PERIODS.map((p) => ({ value: p.value, label: p.label })),
    value: period,
    onChange: (v) => {
      period = v;
      notify();
    },
  });
}

export function exerciseProgress({ key }) {
  const d = data();
  if (key === 'bodyweight') return bodyweightChart(d);

  const ex = findExercise(d, key);
  if (!ex) return { redirect: '/progress' };

  const series = metricSeries(d, ex);
  const best = bestFor(d, ex);
  const goal = ex.progression === 'strict' ? pullupGoal(d, ex) : null;
  const recent = historyFor(d, ex.key).slice(0, 6);

  const el = h(
    'main',
    { class: 'screen' },
    h('div', { class: 'top' }, iconButton('chevron-left', 'Back', () => back('/progress'))),
    h('div', { class: 'title-row' }, h('h1', { class: 'title' }, ex.name), best > 0 ? h('span', { class: 'pill' }, `Best ${bestShort(ex, best)}`) : null),
    periodSwitch(),
    h('section', { class: 'glass card compact' }, h('div', { class: 'label' }, metricLabel(ex)), lineChart(filterPeriod(series), `${ex.name} trend`)),
    goal
      ? h('section', { class: 'glass card compact between' }, h('span', {}, 'Next goal'), h('span', { class: 'amber medium' }, goalLabel(goal)))
      : null,
    recent.length
      ? h(
          'section',
          { class: 'glass list' },
          recent.map(({ session, sets }) =>
            h('div', { class: 'row' }, h('span', { class: 'name' }, dayLabel(session.finishedAt)), h('span', { class: 'muted sec' }, sessionSummary(ex, sets))),
          ),
        )
      : null,
  );
  return { el };
}

function bodyweightChart(d) {
  const points = d.bodyweight.map((e) => ({ t: e.date, v: e.kg }));
  const recent = d.bodyweight.slice(-6).reverse();
  const el = h(
    'main',
    { class: 'screen' },
    h(
      'div',
      { class: 'top' },
      iconButton('chevron-left', 'Back', () => back('/progress')),
      h('button', { class: 'link', type: 'button', onclick: () => go('/progress/bodyweight') }, 'Log weight', icon('plus')),
    ),
    h('h1', { class: 'title' }, 'Bodyweight'),
    periodSwitch(),
    h('section', { class: 'glass card compact' }, h('div', { class: 'label' }, 'Kilograms'), lineChart(filterPeriod(points), 'Bodyweight trend')),
    recent.length
      ? h(
          'section',
          { class: 'glass list' },
          recent.map((e) => h('div', { class: 'row' }, h('span', { class: 'name' }, dayLabel(e.date)), h('span', { class: 'muted sec' }, `${e.kg.toFixed(1)} kg`))),
        )
      : h('p', { class: 'stub' }, 'No entries yet. Log your weight to start the chart.'),
  );
  return { el };
}
