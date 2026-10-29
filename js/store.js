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
export const SCHEMA_VERSION = 1;

// MIGRATIONS[n] upgrades a version n document to version n + 1.
const MIGRATIONS = {};

export function freshData() {
  return {
    version: SCHEMA_VERSION,
    settings: { defaultRest: DEFAULT_REST },
    plan: defaultPlan(),
    sessions: [],
    bodyweight: [],
  };
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return freshData();
  let d = raw;
  let v = Number(d.version) || 0;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (step) d = step(d);
    v += 1;
  }
  d.version = SCHEMA_VERSION;
  d.settings = { defaultRest: DEFAULT_REST, ...(d.settings || {}) };
  d.plan = d.plan && Array.isArray(d.plan.sessions) ? d.plan : defaultPlan();
  d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
  d.bodyweight = Array.isArray(d.bodyweight) ? d.bodyweight : [];
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

export function replaceAll(next) {
  state = migrate(next);
  save();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
