// Exercise animation box at the top of every exercise screen.
//
// Looks for media/exercises/<slug>.gif, then .webp, then .mp4 (muted, looping, inline).
// If none exists, draws the built-in stick figure for that exercise; custom exercises get a plain placeholder.
// Tapping the box pauses and resumes. With reduced motion the animation starts paused.

import { h, reducedMotion } from './dom.js';
import { icon } from './icons.js';
import { FIGURES } from './stickfigures.js';

const BASE = 'media/exercises/';

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
    const svg = ex.slug && FIGURES[ex.slug];
    if (svg) {
      const holder = h('div', { class: 'media-fill', html: svg });
      const root = holder.firstElementChild;
      mount(holder, {
        pause: () => root.classList.add('paused'),
        resume: () => root.classList.remove('paused'),
      });
    } else {
      box.prepend(h('span', { class: 'media-empty' }, icon('player-play'), 'No animation'));
      box.disabled = true;
    }
  };

  const tryVideo = () => {
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
    v.src = `${BASE}${ex.slug}.mp4`;
  };

  const tryImage = (ext, next) => {
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
    img.src = `${BASE}${ex.slug}.${ext}`;
  };

  if (ex.slug) tryImage('gif', () => tryImage('webp', tryVideo));
  else showFallback();

  cached = { key, el: box };
  return box;
}
