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

// ---- Tap, long-press repeat ----

// Calls fire(n) on press (n = 0) and then repeatedly while held. Keyboard activation fires once.
export function bindHold(btn, fire) {
  let delay = 0;
  let repeat = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    fire(0);
    let n = 0;
    delay = setTimeout(() => {
      repeat = setInterval(() => fire(++n), 90);
    }, 420);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, stop);
  // Pointer clicks have detail >= 1 and are handled above.
  btn.addEventListener('click', (e) => {
    if (e.detail === 0) fire(0);
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- Stepper with tap, long-press repeat and typed entry ----

const fmt = (n) => String(Math.round(n * 100) / 100);

export function stepper({ label, value, step = 1, min = 0, max = 999, decimal = false, format, inline = false, onChange }) {
  let v = value;
  const show = (n) => (format ? format(n) : fmt(n));
  const numBtn = h('button', { class: 'sp-num', type: 'button' });
  const sync = () => {
    numBtn.textContent = show(v);
    numBtn.setAttribute('aria-label', `${label}: ${show(v)}. Tap to type a value`);
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
    bindHold(b, (n) => set(v + dir * step * (n > 20 && step === 1 ? 5 : 1)));
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

  const box = h('div', { class: 'stepper' + (inline ? ' inline' : '') }, holdButton(-1, 'minus', 'Decrease'), numBtn, holdButton(1, 'plus', 'Increase'));
  if (inline) return box;
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), box);
}

// Large number with round glass minus and plus buttons (bodyweight, rest timer sheets).
export function bigStepper({ label, value, step, min, max, format, onChange }) {
  let v = value;
  const out = h('div', { class: 'big-num', role: 'status', 'aria-label': label }, format(v));
  const set = (n) => {
    n = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    if (n === v) return;
    v = n;
    out.textContent = format(v);
    onChange(v);
  };
  const btn = (dir, name, aria) => {
    const b = h('button', { class: 'round-btn glass', type: 'button', 'aria-label': `${aria} ${label}` }, icon(name));
    bindHold(b, (n) => set(v + dir * step * (n > 25 ? 5 : 1)));
    return b;
  };
  return h('div', { class: 'big-stepper' }, btn(-1, 'minus', 'Decrease'), out, btn(1, 'plus', 'Increase'));
}

// Segmented control. options: [{ value, label }].
export function segmented({ options, value, onChange, label }) {
  const el = h('div', { class: 'seg glass', role: 'group', 'aria-label': label || null });
  const draw = (cur) => {
    el.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            class: o.value === cur ? 'on' : '',
            type: 'button',
            'aria-pressed': String(o.value === cur),
            onclick: () => {
              if (o.value === cur) return;
              draw(o.value);
              onChange(o.value);
            },
          },
          o.label,
        ),
      ),
    );
  };
  draw(value);
  return el;
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
