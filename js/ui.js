// Shared UI pieces: back button, week bar, underlined name, steppers, sheet, rest button.

import { h } from './dom.js';
import { icon } from './icons.js';
import { clock } from './format.js';

const WAVE =
  '<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M1 6 Q 9 1, 17 6 T 33 6 T 49 6 T 65 6 T 81 6 T 99 6"/></svg>';

// Session name with the solid wavy amber underline. Draws on from left to right when `animate` is set.
export function underlined(text, animate) {
  const el = h('span', { class: 'underlined' + (animate ? ' draw' : '') }, text);
  el.insertAdjacentHTML('beforeend', WAVE);
  return el;
}

export function iconButton(name, label, onClick) {
  return h('button', { class: 'icon-btn glass', type: 'button', 'aria-label': label, onclick: onClick }, icon(name));
}

export function weekBar(count, total = 3) {
  const segs = [];
  for (let i = 0; i < total; i++) segs.push(h('span', { class: i < count ? 'on' : '' }));
  return h('div', { class: 'week', role: 'img', 'aria-label': `${count} of ${total} sessions done this week` }, segs);
}

export function checkCircle() {
  return h('span', { class: 'check' }, icon('check'));
}

// ---- Stepper with tap, long-press repeat and typed entry ----

const fmt = (n) => String(Math.round(n * 100) / 100);

export function stepper({ label, value, step = 1, min = 0, max = 999, decimal = false, onChange }) {
  let v = value;
  const numBtn = h('button', { class: 'sp-num', type: 'button' }, fmt(v));
  const sync = () => {
    numBtn.textContent = fmt(v);
    numBtn.setAttribute('aria-label', `${label}: ${fmt(v)}. Tap to type a value`);
  };
  sync();

  const set = (n) => {
    n = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    if (n === v) return;
    v = n;
    sync();
    onChange(v);
  };

  const holdButton = (dir, name, aria) => {
    const b = h('button', { class: 'sp-btn', type: 'button', 'aria-label': `${aria} ${label}` }, icon(name));
    let delay = 0;
    let repeat = 0;
    const stop = () => {
      clearTimeout(delay);
      clearInterval(repeat);
    };
    b.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      set(v + dir * step);
      let n = 0;
      delay = setTimeout(() => {
        repeat = setInterval(() => {
          n += 1;
          set(v + dir * step * (n > 20 && step === 1 ? 5 : 1));
        }, 90);
      }, 420);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
    // Keyboard activation only; pointer clicks are handled above.
    b.addEventListener('click', (e) => {
      if (e.detail === 0) set(v + dir * step);
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };

  numBtn.addEventListener('click', () => {
    const input = h('input', {
      class: 'sp-input',
      type: 'text',
      inputmode: decimal ? 'decimal' : 'numeric',
      'aria-label': label,
      value: fmt(v),
    });
    input.addEventListener(
      'blur',
      () => {
        const n = parseFloat(input.value.replace(',', '.'));
        if (Number.isFinite(n)) set(n);
        sync();
        input.replaceWith(numBtn);
      },
      { once: true },
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    numBtn.replaceWith(input);
    input.focus();
    input.select();
  });

  const box = h('div', { class: 'stepper' }, holdButton(-1, 'minus', 'Decrease'), numBtn, holdButton(1, 'plus', 'Increase'));
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), box);
}

// ---- Bottom sheet over a dimmed screen ----

export function sheet({ title, content, animate, onClose }) {
  const anim = animate ? '' : ' static';
  const scrim = h('div', { class: 'scrim' + anim });
  const panel = h(
    'div',
    { class: 'sheet glass' + anim, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grab' }),
    h('h2', {}, title),
    content,
  );
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    scrim.classList.remove('static');
    panel.classList.remove('static');
    scrim.classList.add('closing');
    panel.classList.add('closing');
    setTimeout(onClose, 200);
  };
  scrim.addEventListener('click', close);
  return { nodes: [scrim, panel], close };
}

// ---- Rest button: elapsed time fills from the left; label flips to navy over the amber ----

export function restButton(rest, onSkip) {
  const makeLabel = () => {
    const text = h('span', {}, 'Rest 0:00');
    return { el: h('span', { class: 'lbl' }, icon('clock'), text), text };
  };
  const white = makeLabel();
  const navy = makeLabel();
  const fill = h('span', { class: 'fill' }, navy.el);
  const btn = h(
    'button',
    { class: 'btn-rest', type: 'button', 'aria-label': 'Skip rest', onclick: onSkip },
    white.el,
    fill,
  );

  let raf = 0;
  let lastText = '';
  const update = () => {
    const remaining = Math.max(0, rest.endAt - Date.now());
    const frac = Math.min(1, Math.max(0, 1 - remaining / rest.totalMs));
    const text = `Rest ${clock(remaining / 1000)}`;
    if (text !== lastText) {
      lastText = text;
      white.text.textContent = text;
      navy.text.textContent = text;
    }
    fill.style.width = frac * 100 + '%';
    // The navy copy is as wide as the whole button so the text does not shift.
    navy.el.style.width = frac > 0.001 ? 100 / frac + '%' : '0';
    raf = requestAnimationFrame(update);
  };
  update();
  return { el: btn, stop: () => cancelAnimationFrame(raf) };
}

// ---- Exercise animation box (placeholder until animations are added) ----

export function mediaBox() {
  return h('div', { class: 'media glass', role: 'img', 'aria-label': 'Exercise animation' }, icon('player-play'), 'Animation');
}
