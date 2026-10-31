// Data layer: one JSON document in localStorage with a schema version and migrations.
//
// {
//   version, settings: { defaultRest },
//   plan:      { sessions: [ { id, name, kind, exercises: [...] } ] },
//   sessions:  [ { id, planSessionId, name, startedAt, finishedAt, status, exercises: [...], sets: [...] } ],
//   bodyweight: [ { date, kg } ]
// }
//
// Bests, rotation, weekly counts and progression goals are derived from `sessions` (see progression.js).

import { defaultPlan, DEFAULT_REST } from './plan.js';

const KEY = 'setlog.data';
export const SCHEMA_VERSION = 2;

// MIGRATIONS[n] upgrades a version n document to version n + 1. A step must never throw on odd data.
const MIGRATIONS = {
  // Version 1 -> 2: new Push / Pull / Leg program.
  1(d) {
    const oldPlan = d.plan && Array.isArray(d.plan.sessions) ? d.plan : null;
    // Old exercises that are the same movement as a new one keep their history under the new key.
    const MAP = {
      'bench-press': 'bench-press-free',
      'lat-pulldown': 'lat-pulldown-narrow',
      'leg-curl': 'lying-leg-curl',
      'calf-raises': 'standing-calf-raise',
      'pull-ups': 'pull-ups-wide',
    };
    const kindOf = (id) => {
      const ps = oldPlan && oldPlan.sessions.find((s) => s && s.id === id);
      return (ps && ps.kind) || (id === 'quick' ? 'quick' : 'full');
    };
    const sessions = Array.isArray(d.sessions) ? d.sessions : [];
    for (const s of sessions) {
      if (!s || typeof s !== 'object') continue;
      s.kind = s.kind || kindOf(s.planSessionId);
      if (Array.isArray(s.sets)) {
        for (const x of s.sets) if (x && MAP[x.exerciseKey]) x.exerciseKey = MAP[x.exerciseKey];
      }
      if (Array.isArray(s.exercises)) {
        for (const e of s.exercises) if (e && MAP[e.key]) e.key = MAP[e.key];
      }
    }
    d.sessions = sessions;
    // Keep the old plan so nothing is lost, and make the new program the active plan.
    if (oldPlan && !d.archive) d.archive = { plan: oldPlan, archivedAt: Date.now(), fromVersion: 1 };
    d.plan = defaultPlan();
    return d;
  },
};

export function freshData() {
  return {
    version: SCHEMA_VERSION,
    settings: { defaultRest: DEFAULT_REST },
    plan: defaultPlan(),
    sessions: [],
    bodyweight: [],
  };
}

// Defensive clean-up so odd or hand-edited data cannot crash the app.
const isSession = (s) => s && typeof s === 'object' && typeof s.id === 'string' && (s.status === 'done' || s.status === 'open');

function cleanSession(s) {
  s.sets = (Array.isArray(s.sets) ? s.sets : []).filter((x) => x && typeof x === 'object' && typeof x.exerciseKey === 'string');
  s.exercises = (Array.isArray(s.exercises) ? s.exercises : []).filter((e) => e && typeof e === 'object' && typeof e.id === 'string');
  if (typeof s.startedAt !== 'number') s.startedAt = typeof s.finishedAt === 'number' ? s.finishedAt : Date.now();
  if (s.status === 'done' && typeof s.finishedAt !== 'number') s.finishedAt = s.startedAt;
  return s;
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return freshData();
  let d = raw;
  let v = Number(d.version) || 0;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (step) {
      try {
        d = step(d);
      } catch (err) {
        // Never lose history to a failed upgrade: keep the data and just switch to the default plan.
        console.warn('Setlog: upgrade step failed, using the default plan.', err);
        d.plan = defaultPlan();
      }
    }
    v += 1;
  }
  d.version = SCHEMA_VERSION;
  d.settings = { defaultRest: DEFAULT_REST, ...(d.settings || {}) };
  d.plan = d.plan && Array.isArray(d.plan.sessions) ? d.plan : defaultPlan();
  d.sessions = (Array.isArray(d.sessions) ? d.sessions : []).filter(isSession).map(cleanSession);
  d.bodyweight = (Array.isArray(d.bodyweight) ? d.bodyweight : []).filter((e) => e && typeof e.kg === 'number' && typeof e.date === 'number');
  return d;
}

let state;
const listeners = new Set();

function load() {
  let text = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (!text) return freshData();
  try {
    return migrate(JSON.parse(text));
  } catch {
    // Keep the unreadable text so it can be recovered, then start clean.
    try {
      localStorage.setItem(KEY + '.corrupt', text);
    } catch {
      /* ignore */
    }
    return freshData();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function init() {
  state = load();
  save();
  return state;
}

export const data = () => state;

// Ask the app to re-render without changing data (UI-only state such as an open editor).
export function notify() {
  for (const l of listeners) l();
}

export function mutate(fn) {
  fn(state);
  save();
  notify();
}

// Save without re-rendering. Used by editors that update their own controls while the user is mid-gesture.
export function persist() {
  save();
}

export function replaceAll(next) {
  state = migrate(next);
  save();
  notify();
}

// Another tab or the installed app changed the data: pick it up instead of overwriting it later.
window.addEventListener('storage', (e) => {
  if (e.key === KEY && state) {
    state = load();
    notify();
  }
});

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
