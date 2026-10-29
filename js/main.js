// App shell: boot, routing table, rendering, tab bar, service worker.

import * as store from './store.js';
import * as rest from './rest.js';
import * as router from './router.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { today, todayWithChoose } from './screens/today.js';
import { overview } from './screens/overview.js';
import { exercise } from './screens/exercise.js';
import { done } from './screens/done.js';
import { progress, bodyweightSheet, exerciseProgress } from './screens/progress.js';
import { plan, restSheet, backupSheet, editSession, addSheet, swapSheet, editExercise } from './screens/plan.js';

// key: screens with the same key do not replay the enter animation (Today and its sheet).
// tab: which tab is highlighted; screens without one hide the tab bar.
const ROUTES = [
  { pattern: '/', key: 'today', tab: '/', build: today },
  { pattern: '/choose', key: 'today', build: todayWithChoose },
  { pattern: '/progress', key: 'progress', tab: '/progress', build: progress },
  { pattern: '/progress/bodyweight', key: 'progress', build: bodyweightSheet },
  { pattern: '/progress/ex/:key', key: (p) => `px:${p.key}`, build: exerciseProgress },
  { pattern: '/plan', key: 'plan', tab: '/plan', build: plan },
  { pattern: '/plan/rest', key: 'plan', build: restSheet },
  { pattern: '/plan/backup', key: 'plan', build: backupSheet },
  { pattern: '/plan/:sid', key: (p) => `ps:${p.sid}`, build: editSession },
  { pattern: '/plan/:sid/add', key: (p) => `ps:${p.sid}`, build: addSheet },
  { pattern: '/plan/:sid/swap/:exId', key: (p) => `ps:${p.sid}`, build: swapSheet },
  { pattern: '/plan/:sid/:exId', key: (p) => `pe:${p.sid}:${p.exId}`, build: editExercise },
  { pattern: '/session/:sid', key: (p) => `s:${p.sid}`, build: overview },
  { pattern: '/session/:sid/:exId', key: (p) => `e:${p.sid}:${p.exId}`, build: exercise },
  { pattern: '/done/:sid', key: (p) => `d:${p.sid}`, build: done },
];

const TABS = [
  { to: '/', icon: 'home', label: 'Today' },
  { to: '/progress', icon: 'chart-line', label: 'Progress' },
  { to: '/plan', icon: 'list', label: 'Plan' },
];

const view = document.getElementById('view');
const overlay = document.getElementById('overlay');
const tabbar = document.getElementById('tabbar');

let lastKey = null;
let lastPath = null;
let cleanup = null;
let onEscape = null;
let queued = false;

function queueRender() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    render();
  });
}

function render() {
  const p = router.path();
  let found = null;
  for (const r of ROUTES) {
    const params = router.match(r.pattern, p);
    if (params) {
      found = { r, params };
      break;
    }
  }
  if (!found) {
    router.go('/', { replace: true });
    return;
  }
  const { r, params } = found;
  const key = typeof r.key === 'function' ? r.key(params) : r.key;
  const entering = key !== lastKey;
  const pathChanged = p !== lastPath;
  const scrollY = window.scrollY;

  if (cleanup) cleanup();
  cleanup = null;
  onEscape = null;

  const out = r.build(params, { entering, pathChanged });
  if (out.redirect) {
    router.go(out.redirect, { replace: true });
    return;
  }
  if (entering) out.el.classList.add('enter');
  view.replaceChildren(out.el);
  overlay.replaceChildren(...(out.overlay || []));
  cleanup = out.cleanup || null;
  onEscape = out.onEscape || null;

  tabbar.hidden = !r.tab;
  for (const a of tabbar.children) {
    const on = a.dataset.to === r.tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  window.scrollTo(0, entering ? 0 : scrollY);
  lastKey = key;
  lastPath = p;
}

function buildTabs() {
  for (const t of TABS) {
    const a = h('a', { href: '#' + t.to, 'data-to': t.to }, icon(t.icon), t.label);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (router.path() !== t.to) router.go(t.to, { replace: true });
    });
    tabbar.append(a);
  }
}

function boot() {
  store.init();
  rest.init();
  buildTabs();
  router.init(queueRender);
  store.subscribe(queueRender);
  rest.onChange(queueRender);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && onEscape) onEscape();
  });

  // Ask the browser not to evict the data when storage is tight.
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch {
    /* not available */
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
  render();
}

boot();
