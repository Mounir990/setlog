// Everything derived from logged data: history, prefill, hints, bests, rotation, weekly counts.
// Nothing here is stored; it is recomputed from `data.sessions` and `data.plan`.

import { rotationOrder } from './plan.js';

export const DAY = 86400000;
const round2 = (n) => Math.round(n * 100) / 100;

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

export const setsOf = (session, ex) =>
  session.sets.filter((s) => s.exerciseId === ex.id).sort((a, b) => a.setIndex - b.setIndex);

export function exerciseState(session, ex) {
  const logged = setsOf(session, ex).length;
  return { logged, total: ex.sets, done: logged >= ex.sets };
}

// The exercise to mark as current: one that is partly done, otherwise the first not done.
export function currentExercise(session) {
  const open = session.exercises.filter((e) => !exerciseState(session, e).done);
  return open.find((e) => exerciseState(session, e).logged > 0) || open[0] || null;
}

// ---- Prefill and hints ----

function defaults(ex) {
  switch (ex.kind) {
    case 'weighted':
      return { weight: 0, reps: ex.repMin };
    case 'pullup':
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
  for (const k of Object.keys(d)) out[k] = typeof s[k] === 'number' ? s[k] : d[k];
  return out;
}

// Values for the stepper of a given set: same set number of the last session, else the plan default.
// Within a session, the weight of the previous set carries over so a weight change is entered once.
export function prefill(d, session, ex, setIndex) {
  const last = historyFor(d, ex.key, session.id)[0];
  let v = defaults(ex);
  if (last) {
    const base = last.sets.find((s) => s.setIndex === setIndex) || last.sets[last.sets.length - 1];
    v = setValues(ex, base);
  }
  if (ex.kind === 'weighted') {
    const prev = setsOf(session, ex)
      .filter((s) => s.setIndex < setIndex)
      .pop();
    if (prev) {
      // A heavier weight than last time starts again from the low end of the range.
      if (last && prev.weight > v.weight) v.reps = ex.repMin;
      v.weight = prev.weight;
    }
  }
  return v;
}

export const hasHistory = (d, session, ex) => historyFor(d, ex.key, session.id).length > 0;

// Double progression hint: weight to try next, or null.
export function tryWeight(d, session, ex) {
  if (ex.kind !== 'weighted' || ex.progression === 'none' || !ex.step) return null;
  const last = historyFor(d, ex.key, session.id)[0];
  if (!last || last.sets.length < ex.sets) return null;
  const sets = last.sets.slice(0, ex.sets);
  const w = sets[sets.length - 1].weight;
  if (!sets.every((s) => s.weight === w && s.reps >= ex.repMax)) return null;
  // Gap rule: after more than 10 days away, never suggest an increase.
  const latest = Math.max(...sets.map((s) => s.completedAt || 0));
  if (Date.now() - latest > 10 * DAY) return null;
  return round2(w + ex.step);
}

// ---- Bests ----

// Best value of one exercise within the given sets, or 0.
export function bestValue(ex, sets) {
  if (ex.trackBest === false) return 0;
  const vals = sets.map((s) => {
    switch (ex.kind) {
      case 'pullup':
        return s.cleanReps || 0;
      case 'weighted':
        return s.reps >= ex.repMin ? s.weight || 0 : 0;
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
  for (const ex of session.exercises) {
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
  return doneSessions(d).filter(
    (s) => fullIds.has(s.planSessionId) && s.finishedAt >= start && s.finishedAt < end,
  ).length;
}

export const recentSessions = (d, n = 3) => doneSessions(d).slice(0, n);

// Duration in minutes, from start to the last logged set (not to the tap on Finish).
export function sessionMinutes(session) {
  const last = session.sets.reduce((m, s) => Math.max(m, s.completedAt || 0), 0);
  const end = last || session.finishedAt || Date.now();
  return Math.max(1, Math.round((end - session.startedAt) / 60000));
}
