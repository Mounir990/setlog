// State changes for the training loop. Screens call these; they never edit data directly.

import { data, mutate } from './store.js';
import { uid, vibrate } from './dom.js';
import * as rest from './rest.js';

export function startSession(planSessionId) {
  const ps = data().plan.sessions.find((s) => s.id === planSessionId);
  if (!ps) return null;
  const session = {
    id: uid(),
    planSessionId: ps.id,
    name: ps.name,
    startedAt: Date.now(),
    finishedAt: null,
    status: 'open',
    exercises: structuredClone(ps.exercises),
    sets: [],
  };
  mutate((d) => d.sessions.push(session));
  return session.id;
}

// Counts as done only with at least one logged set. An empty session is discarded.
export function finishSession(id) {
  const s = data().sessions.find((x) => x.id === id);
  if (!s) return false;
  rest.clear();
  if (!s.sets.length) {
    mutate((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== id);
    });
    return false;
  }
  mutate(() => {
    s.status = 'done';
    s.finishedAt = Date.now();
  });
  return true;
}

export function logSet(sessionId, ex, setIndex, values, { startRest }) {
  mutate((d) => {
    const s = d.sessions.find((x) => x.id === sessionId);
    s.sets.push({ exerciseId: ex.id, exerciseKey: ex.key, setIndex, ...values, completedAt: Date.now() });
  });
  vibrate(20);
  if (startRest) {
    rest.start({ sessionId, exerciseId: ex.id, seconds: ex.restSec || data().settings.defaultRest });
  } else {
    rest.clear();
  }
}

export function updateSet(sessionId, ex, setIndex, values) {
  mutate((d) => {
    const s = d.sessions.find((x) => x.id === sessionId);
    const rec = s.sets.find((x) => x.exerciseId === ex.id && x.setIndex === setIndex);
    if (rec) Object.assign(rec, values);
  });
}

export function deleteSet(sessionId, ex, setIndex) {
  const r = rest.active();
  if (r && r.exerciseId === ex.id) rest.clear();
  mutate((d) => {
    const s = d.sessions.find((x) => x.id === sessionId);
    s.sets = s.sets.filter((x) => !(x.exerciseId === ex.id && x.setIndex === setIndex));
    for (const x of s.sets) if (x.exerciseId === ex.id && x.setIndex > setIndex) x.setIndex -= 1;
  });
}
