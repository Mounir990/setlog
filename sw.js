// Service worker: precache the app shell so Setlog works fully offline.
// Strategy: network first (short timeout) so a new deploy shows up on the next open,
// falling back to the cache when offline or slow. Bump CACHE when the file list changes.

const CACHE = 'setlog-v8';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/screens.css',
  'js/main.js',
  'js/dom.js',
  'js/icons.js',
  'js/format.js',
  'js/plan.js',
  'js/store.js',
  'js/rest.js',
  'js/router.js',
  'js/progression.js',
  'js/actions.js',
  'js/ui.js',
  'js/media.js',
  'js/chart.js',
  'js/stickfigures.js',
  'js/screens/today.js',
  'js/screens/overview.js',
  'js/screens/exercise.js',
  'js/screens/done.js',
  'js/screens/progress.js',
  'js/screens/plan.js',
  'fonts/bricolage-grotesque-latin-400.woff2',
  'fonts/bricolage-grotesque-latin-500.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'media/exercises/index.json',
  'media/exercises/incline-machine-press.gif',
  'media/exercises/cable-lateral-raise.gif',
  'media/exercises/bench-press-free.gif',
  'media/exercises/bench-press-guided.gif',
  'media/exercises/shoulder-press-machine.gif',
  'media/exercises/dips.gif',
  'media/exercises/skullcrusher-cable.gif',
  'media/exercises/skullcrusher-free.gif',
  'media/exercises/triceps-pushdown-one-hand.gif',
  'media/exercises/pull-ups-wide.gif',
  'media/exercises/pull-ups-narrow.gif',
  'media/exercises/cable-rear-delt-fly.gif',
  'media/exercises/rowing-machine-wide.gif',
  'media/exercises/back-extension.gif',
  'media/exercises/incline-biceps-curl.gif',
  'media/exercises/hammer-curl.gif',
  'media/exercises/standing-calf-raise.gif',
  'media/exercises/hex-squat.gif',
  'media/exercises/lying-leg-curl.gif',
  'media/exercises/leg-extension.gif',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(new Request(a, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handle(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(new Request(request, { cache: 'no-cache' })), timeout(3000)]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(handle(request));
});
