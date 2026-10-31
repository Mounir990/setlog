// Exercise animation box at the top of every exercise screen.
//
// Own animations: put <slug>.gif, <slug>.webp or <slug>.mp4 in media/exercises/ and list the file name in
// media/exercises/index.json. A listed file replaces the built-in stick figure for that exercise.
// Without a listed file the built-in stick figure is drawn; custom exercises get a plain placeholder.
// (The list avoids probing for files that do not exist, which would log errors on every exercise screen.)
// Tapping the box pauses and resumes. With reduced motion the animation starts paused.

import { h, reducedMotion } from './dom.js';
import { icon } from './icons.js';
import { FIGURES } from './stickfigures.js';

const BASE = 'media/exercises/';

// File names listed in media/exercises/index.json. Loaded once; empty if the file is missing.
let listed = null;
const listedReady = fetch(`${BASE}index.json`)
  .then((r) => (r.ok ? r.json() : { files: [] }))
  .then((j) => (Array.isArray(j.files) ? j.files.filter((f) => typeof f === 'string') : []))
  .catch(() => [])
  .then((files) => (listed = files));

// Reuse the element between re-renders so the animation does not restart or flicker.
let cached = null;

export function mediaBox(ex) {
  const key = ex.slug || ex.key;
  if (cached && cached.key === key) return cached.el;

  const playBadge = h('span', { class: 'media-play', hidden: true }, icon('player-play'));
  const box = h('button', { class: 'media glass', type: 'button', 'aria-label': 'Pause animation', 'aria-pressed': 'false' });
  box.append(playBadge);

  let paused = false;
  let controls = { pause() {}, resume() {} };
  const setPaused = (p) => {
    paused = p;
    playBadge.hidden = !p;
    box.setAttribute('aria-label', p ? 'Play animation' : 'Pause animation');
    box.setAttribute('aria-pressed', String(p));
    if (p) controls.pause();
    else controls.resume();
  };
  box.addEventListener('click', () => setPaused(!paused));

  const mount = (el, ctl) => {
    box.prepend(el);
    controls = ctl;
    if (reducedMotion()) setPaused(true);
  };

  const showFallback = () => {
    const figure = ex.slug && FIGURES[ex.slug];
    if (figure) {
      const holder = h('div', { class: 'media-fill', html: figure() });
      const root = holder.firstElementChild;
      mount(holder, {
        // Rig figures use SMIL, the dead hang figure uses CSS animation.
        pause: () => {
          root.classList.add('paused');
          if (root.pauseAnimations) root.pauseAnimations();
        },
        resume: () => {
          root.classList.remove('paused');
          if (root.unpauseAnimations) root.unpauseAnimations();
        },
      });
    } else {
      box.prepend(h('span', { class: 'media-empty' }, icon('player-play'), 'No animation'));
      box.disabled = true;
    }
  };

  const tryVideo = (file) => {
    const v = h('video', { class: 'media-fill', loop: true, playsinline: true, preload: 'auto' });
    v.muted = true;
    v.addEventListener('error', showFallback, { once: true });
    v.addEventListener(
      'loadeddata',
      () => {
        v.play().catch(() => {});
        mount(v, { pause: () => v.pause(), resume: () => v.play() });
      },
      { once: true },
    );
    v.src = `${BASE}${file}`;
  };

  const tryImage = (file, next) => {
    const img = new Image();
    img.className = 'media-fill';
    img.alt = '';
    img.decoding = 'async';
    img.onerror = next;
    img.onload = () => {
      let frozen = null;
      mount(img, {
        // A GIF cannot be paused directly, so a canvas copy of the current frame covers it.
        pause() {
          try {
            frozen = h('canvas', { class: 'media-fill' });
            frozen.width = img.naturalWidth;
            frozen.height = img.naturalHeight;
            frozen.getContext('2d').drawImage(img, 0, 0);
            box.prepend(frozen);
          } catch {
            frozen = null;
          }
        },
        resume() {
          if (frozen) frozen.remove();
          frozen = null;
        },
      });
    };
    img.src = `${BASE}${file}`;
  };

  const start = (files) => {
    const file = ex.slug && files.find((f) => f.replace(/\.[^.]+$/, '') === ex.slug);
    if (!file) showFallback();
    else if (/\.mp4$/i.test(file)) tryVideo(file);
    else tryImage(file, showFallback);
  };
  if (listed) start(listed);
  else listedReady.then(start);

  cached = { key, el: box };
  return box;
}
