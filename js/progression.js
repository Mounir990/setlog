// Everything derived from logged data: history, prefill, bests, rotation, weekly counts.
// The app never suggests a weight or a rep count: it only replays what was entered.
// Nothing here is stored; it is recomputed from `data.sessions` and `data.plan`.

import { rotationOrder, flatten } from './plan.js';

export const DAY = 86400000;

export const doneSessions = (d) =>
  d.sessions.filter((s) => s.status === 'done').sort((a, b) => b.finishedAt - a.finishedAt);

export const openSession = (d) => d.sessions.find((s) => s.status === 'open') || null;

// Done sessions that logged this exercise, newest first: [{ session, sets }] with sets ordered by setIndex.
export function historyFor(d, key, excludeId) {
  const out = [];
  for (const s of doneSessions(d)) {
    if (s.id === excludeId) continue;
    const sets = s.sets.filter((x) => x.exerciseKey === key).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length) out.push({ session: s, sets });
  }
  return out;
}

// Sets of a whole card (every variant or part), ordered.
export const setsOf = (session, card) =>
  session.sets.filter((s) => s.exerciseId === card.id).sort((a, b) => a.setIndex - b.setIndex || (a.part || '').localeCompare(b.part || ''));

// Sets of one flat exercise (one variant or part).
export const setsOfKey = (session, ex) => setsOf(session, ex).filter((s) => s.exerciseKey === ex.key);

// A superset round is done once part B is logged; otherwise every logged set counts.
export function exerciseState(session, card) {
  const all = setsOf(session, card);
  const logged = card.parts ? all.filter((s) => s.part === 'B').length : all.length;
  return { logged, total: card.sets, done: logged >= card.sets };
}

// The exercise to mark as current: one that is partly done, otherwise the first not done.
export function currentExercise(session) {
  const open = session.exercises.filter((e) => !exerciseState(session, e).done);
  return open.find((e) => exerciseState(session, e).logged > 0) || open[0] || null;
}

// ---- Prefill ----

function defaults(ex) {
  switch (ex.kind) {
    case 'weighted':
      return ex.dropset ? { weight: 0, reps: ex.repMin, drops: [] } : { weight: 0, reps: ex.repMin };
    case 'pullup':
      return { cleanReps: ex.repMin || 5, partialReps: 0, weight: 0 };
    case 'easy':
      return { cleanReps: ex.repMin, partialReps: 0 };
    case 'time':
      return { seconds: ex.repMin || 0 };
    default:
      return { reps: ex.repMin || 0 };
  }
}

export function setValues(ex, s) {
  const d = defaults(ex);
  const out = {};
  for (const k of Object.keys(d)) {
    if (k === 'drops') out.drops = Array.isArray(s.drops) ? s.drops.map((x) => ({ weight: x.weight, reps: x.reps })) : [];
    else out[k] = typeof s[k] === 'number' ? s[k] : d[k];
  }
  return out;
}

// Starting values for the fields of a given set: the same set number of the last session (and variant),
// else the plan default. Within a session the weight of the previous set carries over, so a change of weight
// is typed once. These are only a starting point; every field stays editable.
export function prefill(d, session, ex, setIndex) {
  const last = historyFor(d, ex.key, session.id)[0];
  let v = defaults(ex);
  if (last) {
    const base = last.sets.find((s) => s.setIndex === setIndex) || last.sets[last.sets.length - 1];
    v = setValues(ex, base);
  }
  if ('weight' in v) {
    const prev = setsOfKey(session, ex)
      .filter((s) => s.setIndex < setIndex)
      .pop();
    if (prev && typeof prev.weight === 'number') v.weight = prev.weight;
  }
  return v;
}

export const hasHistory = (d, session, ex) => historyFor(d, ex.key, session.id).length > 0;

// Sets of the last session that logged this exercise (and variant), for the "Last time" line. Null if none.
export function lastTime(d, session, ex) {
  const last = historyFor(d, ex.key, session.id)[0];
  return last ? last.sets : null;
}

// ---- Bests ----

export const BODYWEIGHT_BASE = 1000;

// Best value of one exercise within the given sets, or 0.
export function bestValue(ex, sets) {
  if (ex.trackBest === false) return 0;
  const vals = sets.map((s) => {
    switch (ex.kind) {
      case 'pullup':
        return s.cleanReps || 0;
      case 'weighted':
        if (s.reps < ex.repMin) return 0;
        // Bodyweight lifts (dips): added kg beats reps. Reps alone score below BODYWEIGHT_BASE.
        if (ex.bodyweight) return s.weight > 0 ? BODYWEIGHT_BASE + s.weight : s.reps || 0;
        return s.weight || 0;
      case 'time':
        return s.seconds || 0;
      case 'easy':
        return 0;
      default:
        return s.reps || 0;
    }
  });
  return vals.length ? Math.max(0, ...vals) : 0;
}

// Current best across every logged set, including the open session.
export function bestFor(d, ex) {
  const sets = d.sessions.flatMap((s) => s.sets.filter((x) => x.exerciseKey === ex.key));
  return bestValue(ex, sets);
}

// New bests of a finished session: higher than every earlier best. A first-ever result sets a baseline, not a PR.
export function newBests(d, session) {
  const out = [];
  const seen = new Set();
  for (const ex of session.exercises.flatMap(flatten)) {
    if (seen.has(ex.key) || ex.trackBest === false) continue;
    seen.add(ex.key);
    const now = bestValue(ex, session.sets.filter((s) => s.exerciseKey === ex.key));
    if (!now) continue;
    const prior = d.sessions
      .filter((s) => s.status === 'done' && s.id !== session.id && s.finishedAt < session.finishedAt)
      .flatMap((s) => s.sets.filter((x) => x.exerciseKey === ex.key));
    const before = bestValue(ex, prior);
    if (before > 0 && now > before) out.push({ ex, value: now });
  }
  return out;
}

// ---- Rotation and weeks ----

export function nextPlanSession(d) {
  const order = rotationOrder(d.plan);
  if (!order.length) return d.plan.sessions[0] || null;
  const lastFull = doneSessions(d).find((s) => order.some((o) => o.id === s.planSessionId));
  if (!lastFull) return order[0];
  const i = order.findIndex((o) => o.id === lastFull.planSessionId);
  return order[(i + 1) % order.length];
}

export function weekStart(now = new Date()) {
  const x = new Date(now);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x.getTime();
}

// Completed full sessions in the current week (Monday to Sunday). Quick sessions do not count.
export function weekCount(d) {
  const start = weekStart();
  const end = start + 7 * DAY;
  const fullIds = new Set(d.plan.sessions.filter((s) => s.kind === 'full').map((s) => s.id));
  const isFull = (s) => (s.kind ? s.kind === 'full' : fullIds.has(s.planSessionId));
  return doneSessions(d).filter((s) => isFull(s) && s.finishedAt >= start && s.finishedAt < end).length;
}

export const recentSessions = (d, n = 3) => doneSessions(d).slice(0, n);

// Duration in minutes, from start to the last logged set (not to the tap on Finish).
export function sessionMinutes(session) {
  const last = session.sets.reduce((m, s) => Math.max(m, s.completedAt || 0), 0);
  const end = last || session.finishedAt || Date.now();
  return Math.max(1, Math.round((end - session.startedAt) / 60000));
}

// ---- Progress metrics ----

// One number per session for the progress charts.
export function sessionMetric(ex, sets) {
  if (!sets.length) return 0;
  switch (ex.kind) {
    case 'pullup':
      return Math.max(0, ...sets.map((s) => s.cleanReps || 0));
    case 'weighted':
      // Bodyweight lifts chart the best set in reps; the added kg show in the best and the list.
      return ex.bodyweight ? Math.max(0, ...sets.map((s) => s.reps || 0)) : bestValue(ex, sets);
    case 'time':
      return Math.max(0, ...sets.map((s) => s.seconds || 0));
    default:
      return ex.key === 'push-ups'
        ? sets.reduce((sum, s) => sum + (s.reps || 0), 0)
        : Math.max(0, ...sets.map((s) => s.reps || 0));
  }
}

export function metricLabel(ex) {
  switch (ex.kind) {
    case 'pullup':
      return 'Clean reps, best set';
    case 'weighted':
      return ex.bodyweight ? 'Reps, best set' : 'Weight in kg, best set';
    case 'time':
      return 'Hold in seconds, best set';
    default:
      return ex.key === 'push-ups' ? 'Total reps per session' : 'Reps, best set';
  }
}

// Chronological [{ t, v, session, sets }] over finished sessions.
export function metricSeries(d, ex) {
  const out = [];
  for (const { session, sets } of historyFor(d, ex.key).reverse()) {
    const v = sessionMetric(ex, sets);
    if (v > 0) out.push({ t: session.finishedAt, v, session, sets });
  }
  return out;
}

// Progress entries: one per exercise, with a switch between variants. Active exercises (in the plan) come first
// in plan order, then archived ones (logged before but no longer in the plan). Only exercises with history appear.
// Group: { name, archived, entries: [{ key, label, ex }] }.
export function progressGroups(d) {
  const logged = new Set(doneSessions(d).flatMap((s) => s.sets.map((x) => x.exerciseKey)));
  const groups = [];
  const active = new Set();

  const entriesOf = (card) => flatten(card).map((ex) => ({ key: ex.key, label: ex.variantLabel || null, ex }));
  const addCard = (card, archived) => {
    const entries = entriesOf(card).filter((e) => e.ex.trackBest !== false);
    if (card.parts) {
      for (const e of entries) groups.push({ name: e.ex.name, archived, entries: [e] });
    } else if (entries.length) {
      groups.push({ name: card.name, archived, entries });
    }
  };

  for (const ps of d.plan.sessions) {
    for (const card of ps.exercises) {
      for (const ex of flatten(card)) active.add(ex.key);
      addCard(card, false);
    }
  }
  const seen = new Set(active);
  for (const s of d.sessions.slice().sort((a, b) => b.startedAt - a.startedAt)) {
    for (const card of s.exercises || []) {
      const old = entriesOf(card).filter((e) => !seen.has(e.key) && e.ex.trackBest !== false);
      for (const e of old) {
        seen.add(e.key);
        groups.push({ name: e.ex.variantLabel ? `${e.ex.name}, ${e.ex.variantLabel}` : e.ex.name, archived: true, entries: [{ ...e, label: null }] });
      }
    }
  }
  return groups
    .map((g) => ({ ...g, entries: g.entries.filter((e) => logged.has(e.key)) }))
    .filter((g) => g.entries.length);
}

export function groupOfKey(d, key) {
  return progressGroups(d).find((g) => g.entries.some((e) => e.key === key)) || null;
}

// Flat exercise definition for a key: from the plan first, then from session snapshots.
export function findExercise(d, key) {
  for (const ps of d.plan.sessions) {
    for (const card of ps.exercises) {
      const ex = flatten(card).find((e) => e.key === key);
      if (ex) return ex;
    }
  }
  for (const s of d.sessions) {
    for (const card of s.exercises || []) {
      const ex = flatten(card).find((e) => e.key === key);
      if (ex) return ex;
    }
  }
  return null;
}

// Variant to use for a card: the one picked in this session, else the last one used, else the first.
export function chosenKey(d, session, card) {
  if (!card.variants) return null;
  const picked = session.variants && session.variants[card.id];
  if (picked && card.variants.some((v) => v.key === picked)) return picked;
  const keys = new Set(card.variants.map((v) => v.key));
  for (const s of doneSessions(d)) {
    const hit = s.sets.find((x) => keys.has(x.exerciseKey));
    if (hit) return hit.exerciseKey;
  }
  return card.variants[0].key;
}

export const latestBodyweight = (d) => (d.bodyweight.length ? d.bodyweight[d.bodyweight.length - 1] : null);
