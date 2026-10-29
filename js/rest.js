// Rest timer. State is an end timestamp, never an interval counter, so it stays
// correct when the screen locks or the app is closed and reopened.

import { vibrate } from './dom.js';

const KEY = 'setlog.rest';
let timer = 0;
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function write(v) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function notify(reason) {
  for (const l of listeners) l(reason);
}

// Current rest, or null when none is running.
export function active() {
  const r = read();
  return r && r.endAt > Date.now() ? r : null;
}

export function start({ sessionId, exerciseId, seconds }) {
  write({ sessionId, exerciseId, endAt: Date.now() + seconds * 1000, totalMs: seconds * 1000 });
  schedule();
  notify('start');
}

export function clear() {
  clearTimeout(timer);
  write(null);
  notify('clear');
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function schedule() {
  clearTimeout(timer);
  const r = read();
  if (!r) return;
  timer = setTimeout(() => finish(), Math.max(0, r.endAt - Date.now()));
}

function finish() {
  const r = read();
  if (!r) return;
  const late = Date.now() - r.endAt;
  if (late < -50) {
    schedule();
    return;
  }
  write(null);
  // Only buzz when the rest just ended; stay quiet if the app was closed for a while.
  if (late < 3000) vibrate([30, 40, 30]);
  notify('end');
}

export function init() {
  const r = read();
  if (r) finish();
  if (read()) schedule();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && read()) finish();
  });
}
