// Screens 11 and 12: Plan, edit a session, edit an exercise, plus the rest timer, backup and picker sheets.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { data, persist, replaceAll, SCHEMA_VERSION } from '../store.js';
import { go, back } from '../router.js';
import { clock, targetLabel, ago } from '../format.js';
import { CATALOG, makeExercise, flatten } from '../plan.js';
import { underlined, iconButton, stepper, bigStepper, segmented, sheet } from '../ui.js';

const countLabel = (n) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;

// ---- Plan ----

export function plan() {
  const d = data();
  const sessions = d.plan.sessions.map((s) =>
    h(
      'button',
      { class: 'row', type: 'button', onclick: () => go(`/plan/${s.id}`) },
      h('span', { class: 'name' }, s.name, h('span', { class: 'muted cap block' }, countLabel(s.exercises.length))),
      icon('chevron-right'),
    ),
  );
  const el = h(
    'main',
    { class: 'screen has-tabs' },
    h('h1', { class: 'title' }, 'Plan'),
    h('section', { class: 'glass list' }, sessions),
    h(
      'section',
      { class: 'glass list' },
      h(
        'button',
        { class: 'row', type: 'button', onclick: () => go('/plan/rest') },
        h('span', { class: 'name' }, 'Rest timer'),
        h('span', { class: 'end' }, h('span', { class: 'muted' }, clock(d.settings.defaultRest)), icon('chevron-right')),
      ),
      h(
        'button',
        { class: 'row', type: 'button', onclick: () => go('/plan/backup') },
        h('span', { class: 'name' }, 'Back up data'),
        icon('chevron-right'),
      ),
    ),
  );
  return { el };
}

export function restSheet(params, ctx) {
  const base = plan(params, ctx);
  const d = data();
  let sec = d.settings.defaultRest;
  let sh;
  const save = () => {
    d.settings.defaultRest = sec;
    persist();
    sh.close();
  };
  const content = h(
    'div',
    { class: 'sheet-body' },
    h('p', { class: 'muted sec' }, 'Used when an exercise has no rest of its own.'),
    bigStepper({ label: 'rest', value: sec, step: 15, min: 15, max: 600, format: clock, onChange: (v) => (sec = v) }),
    h('button', { class: 'btn-primary', type: 'button', onclick: save }, 'Save'),
  );
  sh = sheet({ title: 'Rest timer', content, animate: ctx.pathChanged, onClose: () => back('/plan') });
  return { el: base.el, overlay: sh.nodes, onEscape: sh.close };
}

// ---- Back up data ----

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function backupSheet(params, ctx) {
  const base = plan(params, ctx);
  const body = h('div', { class: 'sheet-body' });
  let sh;

  const showMain = (message) => {
    const d = data();
    const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr', tabindex: '-1' });
    input.addEventListener('change', () => readFile(input.files && input.files[0]));
    body.replaceChildren(
      h('p', { class: 'muted sec' }, 'Your history is stored only in this browser. Export a file now and then, and import it to restore.'),
      h(
        'div',
        { class: 'list-plain' },
        h(
          'button',
          { class: 'row', type: 'button', onclick: exportBackup },
          h('span', { class: 'name' }, 'Export backup', h('span', { class: 'muted cap block' }, `Last backup: ${ago(d.settings.lastBackupAt)}`)),
          icon('chevron-right'),
        ),
        h('button', { class: 'row top-line', type: 'button', onclick: () => input.click() }, h('span', { class: 'name' }, 'Import backup'), icon('chevron-right')),
      ),
      message ? h('p', { class: 'sec', role: 'status' }, message) : null,
      input,
    );
  };

  async function exportBackup() {
    const d = data();
    const text = JSON.stringify({ app: 'setlog', exportedAt: new Date().toISOString(), ...d }, null, 2);
    const file = new File([text], `setlog-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Setlog backup' });
      else downloadFile(file);
      d.settings.lastBackupAt = Date.now();
      persist();
      showMain('Backup exported.');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      showMain('The backup could not be exported. Try again.');
    }
  }

  async function readFile(file) {
    if (!file) return;
    let obj;
    try {
      obj = JSON.parse(await file.text());
    } catch {
      showMain('That file could not be read. Choose a backup exported from Setlog.');
      return;
    }
    if (!obj || !Array.isArray(obj.sessions) || !obj.plan || !Array.isArray(obj.plan.sessions)) {
      showMain('That file is not a Setlog backup. Choose a backup exported from Setlog.');
      return;
    }
    if ((Number(obj.version) || 0) > SCHEMA_VERSION) {
      showMain('This backup comes from a newer version of Setlog. Update the app and try again.');
      return;
    }
    const done = obj.sessions.filter((s) => s.status === 'done');
    delete obj.app;
    delete obj.exportedAt;
    body.replaceChildren(
      h('p', {}, 'Replace all data?'),
      h('p', { class: 'muted sec' }, `This backup has ${done.length} finished ${done.length === 1 ? 'session' : 'sessions'}. Your current data on this device will be replaced.`),
      h(
        'button',
        {
          class: 'btn-primary',
          type: 'button',
          onclick: () => {
            replaceAll(obj);
            back('/plan');
          },
        },
        'Replace data',
      ),
      h('button', { class: 'link', type: 'button', onclick: () => showMain() }, 'Cancel'),
    );
  }

  showMain();
  sh = sheet({ title: 'Back up data', content: body, animate: ctx.pathChanged, onClose: () => back('/plan') });
  return { el: base.el, overlay: sh.nodes, onEscape: sh.close };
}

// ---- Edit a session ----

const ACTIONS_W = 156;

function findPlanSession(sid) {
  return data().plan.sessions.find((s) => s.id === sid) || null;
}

export function editSession({ sid }, ctx) {
  const ps = findPlanSession(sid);
  if (!ps) return { redirect: '/plan' };

  const list = h('section', { class: 'glass list reorder' });
  let openRow = null;

  const commitOrder = () => {
    const ids = [...list.children].map((r) => r.dataset.id);
    ps.exercises = ids.map((id) => ps.exercises.find((e) => e.id === id));
    persist();
  };

  const makeRow = (ex) => {
    const grip = h('button', { class: 'grip', type: 'button', 'aria-label': `Reorder ${ex.name}. Use the up and down arrow keys.` }, icon('grip-vertical'));
    const name = h('button', { class: 'row-name', type: 'button' }, h('span', { class: 'name' }, ex.name), h('span', { class: 'muted sec' }, targetLabel(flatten(ex)[0])));
    const main = h('div', { class: 'swipe-main row' }, grip, name);
    const swap = h('button', { class: 'swipe-act', type: 'button', onclick: () => go(`/plan/${sid}/swap/${encodeURIComponent(ex.id)}`) }, 'Swap');
    const remove = h(
      'button',
      {
        class: 'swipe-act',
        type: 'button',
        onclick: () => {
          ps.exercises = ps.exercises.filter((e) => e.id !== ex.id);
          persist();
          row.remove();
        },
      },
      'Remove',
    );
    const row = h('div', { class: 'swipe', 'data-id': ex.id }, h('div', { class: 'swipe-actions' }, swap, remove), main);

    const setX = (x, animate) => {
      main.style.transition = animate ? 'transform var(--t-base) ease-out' : 'none';
      main.style.transform = x ? `translateX(${x}px)` : '';
      row.classList.toggle('revealed', x < 0);
    };
    const close = () => {
      setX(0, true);
      if (openRow === row) openRow = null;
    };
    row.closeSwipe = close;

    // Swipe left to reveal Swap and Remove.
    let start = null;
    let swiped = false;
    main.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.grip') || e.button) return;
      start = { x: e.clientX, y: e.clientY, base: row.classList.contains('revealed') ? -ACTIONS_W : 0, id: e.pointerId, live: false };
      swiped = false;
    });
    main.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.live) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          start.live = true;
          swiped = true;
          main.setPointerCapture(start.id);
          if (openRow && openRow !== row) openRow.closeSwipe();
        } else if (Math.abs(dy) > 10) {
          start = null;
          return;
        } else return;
      }
      setX(Math.max(-ACTIONS_W, Math.min(0, start.base + dx)), false);
    });
    const end = (e) => {
      if (!start) return;
      if (start.live) {
        const x = start.base + (e.clientX - start.x);
        if (x < -ACTIONS_W / 2) {
          setX(-ACTIONS_W, true);
          openRow = row;
        } else close();
      }
      start = null;
    };
    main.addEventListener('pointerup', end);
    main.addEventListener('pointercancel', end);

    name.addEventListener('click', () => {
      if (swiped) {
        swiped = false;
        return;
      }
      if (row.classList.contains('revealed')) {
        close();
        return;
      }
      go(`/plan/${sid}/${encodeURIComponent(ex.id)}`);
    });

    // Drag the grip to reorder (arrow keys too).
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      row.classList.add('lifted');
      const move = (ev) => {
        const sibs = [...list.children].filter((r) => r !== row);
        const ref = sibs.find((r) => {
          const b = r.getBoundingClientRect();
          return ev.clientY < b.top + b.height / 2;
        });
        if ((ref || null) !== row.nextElementSibling) list.insertBefore(row, ref || null);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        row.classList.remove('lifted');
        commitOrder();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
      else if (e.key === 'ArrowDown' && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
      else return;
      e.preventDefault();
      commitOrder();
      grip.focus();
    });
    return row;
  };

  list.append(...ps.exercises.map(makeRow));

  const el = h(
    'main',
    { class: 'screen' },
    h('div', { class: 'top' }, iconButton('chevron-left', 'Back', () => back('/plan'))),
    h('h1', { class: 'title', style: 'margin-bottom:8px' }, underlined(ps.name, ctx.entering)),
    list,
    h('p', { class: 'muted cap' }, 'Changes apply to sessions you start from now on.'),
    h('div', { class: 'bottom' }, h('button', { class: 'btn-primary', type: 'button', onclick: () => go(`/plan/${sid}/add`) }, 'Add exercise')),
  );
  return { el };
}

// ---- Add or swap an exercise ----

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function uniqueId(ps, base) {
  let id = base;
  let n = 2;
  while (ps.exercises.some((e) => e.id === id)) id = `${base}-${n++}`;
  return id;
}

function customExercise(ps, name, kind) {
  const weighted = kind === 'weighted';
  const key = `custom:${slugify(name) || 'exercise'}`;
  return {
    id: uniqueId(ps, `${ps.id}.${key}`),
    key,
    slug: null,
    name,
    kind,
    sets: 3,
    repMin: weighted ? 8 : 0,
    repMax: weighted ? 12 : 0,
    max: !weighted,
    restSec: 90,
    step: weighted ? 2.5 : 0,
    progression: weighted ? 'double' : 'none',
    trackBest: true,
    note: '',
  };
}

function pickerSheet({ sid, ctx, title, taken, onPick }) {
  const base = editSession({ sid }, { ...ctx, entering: false });
  if (base.redirect) return base;
  const ps = findPlanSession(sid);
  const body = h('div', { class: 'sheet-body' });
  let sh;

  const pick = (ex) => {
    onPick(ps, ex);
    persist();
    sh.close();
  };

  const showList = () => {
    const rows = CATALOG.filter((t) => !taken.has(t.group || t.slug)).map((t) =>
      h(
        'button',
        {
          class: 'row top-line',
          type: 'button',
          onclick: () => pick({ ...makeExercise(sid, t), id: uniqueId(ps, `${sid}.${t.group || t.slug}`) }),
        },
        h('span', { class: 'name' }, t.name),
        h('span', { class: 'muted sec' }, targetLabel(flatten(t)[0])),
      ),
    );
    body.replaceChildren(
      h(
        'div',
        { class: 'scroll-list' },
        h('button', { class: 'row', type: 'button', onclick: showCustom }, h('span', { class: 'name' }, 'Custom exercise'), icon('chevron-right')),
        rows,
      ),
    );
  };

  const showCustom = () => {
    let kind = 'weighted';
    const input = h('input', { class: 'text-input', type: 'text', placeholder: 'Exercise name', maxlength: '40', 'aria-label': 'Exercise name' });
    const add = h(
      'button',
      {
        class: 'btn-primary',
        type: 'button',
        onclick: () => {
          const name = input.value.trim();
          if (!name) {
            input.focus();
            return;
          }
          pick(customExercise(ps, name, kind));
        },
      },
      'Add exercise',
    );
    body.replaceChildren(
      input,
      segmented({
        label: 'Type',
        options: [
          { value: 'weighted', label: 'Weight and reps' },
          { value: 'reps', label: 'Reps' },
          { value: 'time', label: 'Time' },
        ],
        value: kind,
        onChange: (v) => (kind = v),
      }),
      add,
      h('button', { class: 'link', type: 'button', onclick: showList }, 'Back to list'),
    );
    input.focus();
  };

  showList();
  sh = sheet({ title, content: body, animate: ctx.pathChanged, onClose: () => back(`/plan/${sid}`) });
  return { el: base.el, overlay: sh.nodes, onEscape: sh.close };
}

export function addSheet({ sid }, ctx) {
  const ps = findPlanSession(sid);
  if (!ps) return { redirect: '/plan' };
  const taken = new Set(ps.exercises.map((e) => e.group || e.slug).filter(Boolean));
  return pickerSheet({ sid, ctx, title: 'Add exercise', taken, onPick: (p, ex) => p.exercises.push(ex) });
}

export function swapSheet({ sid, exId }, ctx) {
  const ps = findPlanSession(sid);
  if (!ps) return { redirect: '/plan' };
  const target = ps.exercises.find((e) => e.id === exId);
  if (!target) return { redirect: `/plan/${sid}` };
  const taken = new Set(ps.exercises.filter((e) => e.id !== exId).map((e) => e.group || e.slug).filter(Boolean));
  return pickerSheet({
    sid,
    ctx,
    title: `Swap ${target.name}`,
    taken,
    onPick: (p, ex) => {
      p.exercises[p.exercises.findIndex((e) => e.id === exId)] = ex;
    },
  });
}

// ---- Edit an exercise ----

export function editExercise({ sid, exId }) {
  const ps = findPlanSession(sid);
  if (!ps) return { redirect: '/plan' };
  const card = ps.exercises.find((e) => e.id === exId);
  if (!card) return { redirect: `/plan/${sid}` };

  const host = h('section', { class: 'glass list' });
  let vi = 0; // which variant is being edited

  // Sets and rest live on the card; reps, step, progression and target live on the variant or part (or the card).
  const targets = () => {
    if (card.parts) return card.parts.map((p, i) => ({ obj: p, title: `${'AB'[i]} · ${p.name}` }));
    if (card.variants) return [{ obj: card.variants[vi], title: null }];
    return [{ obj: card, title: null }];
  };
  const get = (obj, prop) => (obj[prop] !== undefined ? obj[prop] : card[prop]);
  const kindOf = (obj) => obj.kind || card.kind;

  const row = (label, control) => h('div', { class: 'row' }, h('span', { class: 'name' }, label), h('span', { class: 'end' }, control));
  const stack = (label, control) => h('div', { class: 'row stack' }, h('span', { class: 'name' }, label), control);
  const num2 = (label, obj, prop, o = {}) =>
    row(
      label,
      stepper({
        label,
        value: get(obj, prop) || 0,
        step: o.step || 1,
        min: o.min ?? 1,
        max: o.max ?? 99,
        decimal: !!o.decimal,
        format: o.format,
        inline: true,
        onChange: (v) => {
          obj[prop] = v;
          if (o.after) o.after(v);
          persist();
          if (o.redraw) draw();
        },
      }),
    );

  // Rows for one variant, part or plain exercise.
  const kindRows = (obj) => {
    const kind = kindOf(obj);
    const out = [];
    if (kind === 'pullup' || kind === 'easy') {
      out.push(num2('Clean reps', obj, 'repMin', { max: 30, after: (v) => (obj.repMax = v) }));
    } else if (kind === 'weighted') {
      out.push(
        num2('Reps from', obj, 'repMin', {
          max: 50,
          redraw: true,
          after: (v) => {
            if (get(obj, 'repMax') < v || get(obj, 'progression') === 'fixed') obj.repMax = v;
          },
        }),
      );
      if (get(obj, 'progression') !== 'fixed') out.push(num2('Reps up to', obj, 'repMax', { min: get(obj, 'repMin'), max: 50 }));
      out.push(num2('Weight step, kg', obj, 'step', { step: 0.5, min: 0.5, max: 20, decimal: true }));
      out.push(
        stack(
          'Progression',
          segmented({
            label: 'Progression',
            options: [
              { value: 'double', label: 'Rep range' },
              { value: 'fixed', label: 'Fixed reps' },
              { value: 'none', label: 'Off' },
            ],
            value: get(obj, 'progression'),
            onChange: (v) => {
              obj.progression = v;
              if (v === 'fixed') obj.repMax = get(obj, 'repMin');
              else if (v === 'double' && get(obj, 'repMax') <= get(obj, 'repMin')) obj.repMax = get(obj, 'repMin') + 2;
              persist();
              draw();
            },
          }),
        ),
      );
    } else {
      const unit = kind === 'time' ? 'Seconds' : 'Reps';
      out.push(
        stack(
          'Target',
          segmented({
            label: 'Target',
            options: [
              { value: 'max', label: 'Max' },
              { value: 'fixed', label: 'Fixed' },
            ],
            value: get(obj, 'max') ? 'max' : 'fixed',
            onChange: (v) => {
              obj.max = v === 'max';
              if (obj.max) obj.repMin = obj.repMax = 0;
              else if (!get(obj, 'repMin')) obj.repMin = obj.repMax = kind === 'time' ? 30 : 8;
              persist();
              draw();
            },
          }),
        ),
      );
      if (!get(obj, 'max')) out.push(num2(unit, obj, 'repMin', { max: 300, after: (v) => (obj.repMax = v) }));
    }
    return out;
  };

  function draw() {
    const rows = [];
    if (card.variants && card.variants.length > 1) {
      rows.push(
        stack(
          'Variant',
          segmented({
            label: 'Variant',
            options: card.variants.map((v, i) => ({ value: i, label: v.label })),
            value: vi,
            onChange: (i) => {
              vi = i;
              draw();
            },
          }),
        ),
      );
    }
    rows.push(num2(card.parts ? 'Rounds' : 'Sets', card, 'sets', { max: 12 }));
    for (const t of targets()) {
      if (t.title) rows.push(h('div', { class: 'row' }, h('span', { class: 'label' }, t.title)));
      rows.push(...kindRows(t.obj));
    }
    if (targets().some((t) => kindOf(t.obj) === 'weighted')) {
      rows.push(
        stack(
          'Dropset',
          segmented({
            label: 'Dropset',
            options: [
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ],
            value: card.dropset ? 'on' : 'off',
            onChange: (v) => {
              card.dropset = v === 'on';
              persist();
            },
          }),
        ),
      );
    }
    rows.push(num2(card.parts ? 'Rest after the pair' : 'Rest', card, 'restSec', { step: 15, min: 15, max: 600, format: clock }));
    host.replaceChildren(...rows);
  }
  draw();

  const first = flatten(card)[0];
  const el = h(
    'main',
    { class: 'screen' },
    h('div', { class: 'top' }, iconButton('chevron-left', 'Back', () => back(`/plan/${sid}`))),
    h('div', { class: 'title-row' }, h('h1', { class: 'title' }, card.name), h('span', { class: 'muted sec' }, targetLabel(first))),
    host,
    h(
      'section',
      { class: 'glass list' },
      h('button', { class: 'row', type: 'button', onclick: () => go(`/plan/${sid}/swap/${encodeURIComponent(card.id)}`) }, h('span', { class: 'name' }, 'Swap exercise'), icon('chevron-right')),
      h(
        'button',
        {
          class: 'row',
          type: 'button',
          onclick: () => {
            ps.exercises = ps.exercises.filter((e) => e.id !== card.id);
            persist();
            back(`/plan/${sid}`);
          },
        },
        h('span', { class: 'name' }, 'Remove from session'),
      ),
    ),
    h('p', { class: 'muted cap' }, 'Changes apply to sessions you start from now on. Logged history stays.'),
  );
  return { el };
}
