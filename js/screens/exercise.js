// Screens 4, 5 and 6: exercise (pull-ups, weighted lift, push-ups, variants, dropsets, supersets) and the rest state.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { data, notify } from '../store.js';
import { back } from '../router.js';
import { setSummary, bestShort } from '../format.js';
import { flatten, resolve } from '../plan.js';
import {
  setsOf,
  prefill,
  setValues,
  hasHistory,
  tryWeight,
  bestFor,
  pullupGoal,
  historyFor,
  chosenKey,
  dropWeight,
} from '../progression.js';
import { logSet, updateSet, deleteSet, setVariant } from '../actions.js';
import * as rest from '../rest.js';
import { iconButton, stepper, checkCircle, restButton, segmented } from '../ui.js';
import { mediaBox } from '../media.js';

// Unsaved stepper values, kept across re-renders: "sessionId:cardId:setIndex:exerciseKey" -> values.
const drafts = new Map();
// Which logged set (or superset round) is open for editing, if any.
let editing = null;

const draftKey = (sid, ex, i) => `${sid}:${ex.id}:${i}:${ex.key}`;
const copy = (v) => ({ ...v, ...(v.drops ? { drops: v.drops.map((x) => ({ ...x })) } : {}) });

function fieldsFor(ex, weightedPullups) {
  switch (ex.kind) {
    case 'pullup':
    case 'easy':
      return [
        { label: 'Clean', prop: 'cleanReps' },
        { label: 'Partial', prop: 'partialReps' },
        // Added weight appears once the pull-up ladder reaches the weighted stage.
        ...(weightedPullups ? [{ label: 'Added kg', prop: 'weight', step: 2.5, decimal: true }] : []),
      ];
    case 'weighted':
      return [
        { label: ex.bodyweight ? 'Added kg' : 'kg', prop: 'weight', step: ex.step || 1, decimal: true },
        { label: 'Reps', prop: 'reps' },
      ];
    case 'time':
      return [{ label: 'Seconds', prop: 'seconds' }];
    default:
      return [{ label: 'Reps', prop: 'reps' }];
  }
}

export function exercise({ sid, exId }) {
  const d = data();
  const session = d.sessions.find((s) => s.id === sid);
  if (!session) return { redirect: '/' };
  if (session.status === 'done') return { redirect: `/done/${sid}` };
  const card = session.exercises.find((e) => e.id === exId);
  if (!card) return { redirect: `/session/${sid}` };

  const isSuper = Array.isArray(card.parts);
  const flats = flatten(card);
  const vKey = chosenKey(d, session, card);
  const ex = isSuper ? flats[0] : resolve(card, vKey);
  const [partA, partB] = isSuper ? flats : [];

  const position = session.exercises.indexOf(card) + 1;
  const editKey = `${sid}:${exId}`;
  const editIdx = editing && editing.key === editKey ? editing.idx : null;

  // Sets by round: { x } for a plain exercise, { A, B } for a superset.
  const byIdx = new Map();
  for (const s of setsOf(session, card)) {
    if (!byIdx.has(s.setIndex)) byIdx.set(s.setIndex, {});
    byIdx.get(s.setIndex)[s.part || 'x'] = s;
  }
  const roundDone = (i) => {
    const e = byIdx.get(i);
    return !!e && (isSuper ? !!e.B : !!e.x);
  };

  let activeIdx = null;
  for (let i = 1; i <= card.sets; i++) {
    if (!roundDone(i)) {
      activeIdx = i;
      break;
    }
  }
  const activeEntry = activeIdx ? byIdx.get(activeIdx) || {} : {};
  // Superset: the part being worked on decides the animation and the button.
  const activePart = isSuper ? (activeEntry.A ? partB : partA) : ex;

  const stopEditing = () => {
    if (editIdx != null) for (const f of flats) drafts.delete(draftKey(sid, f, editIdx));
    editing = null;
  };

  // ---- Drafts and editors ----

  const draftFor = (fx, i, existing) => {
    const k = draftKey(sid, fx, i);
    if (!drafts.has(k)) drafts.set(k, existing ? setValues(fx, existing) : prefill(d, session, fx, i));
    return drafts.get(k);
  };

  const weightedPullups = (fx) =>
    fx.kind === 'pullup' &&
    (pullupGoal(d, fx, session.id).weight > 0 ||
      historyFor(d, fx.key, session.id).some((x) => x.sets.some((s) => s.weight > 0)) ||
      session.sets.some((s) => s.exerciseKey === fx.key && s.weight > 0));

  const steppers = (fx, draft, onWeightChange) => {
    const wp = weightedPullups(fx);
    return h(
      'div',
      { class: 'fields' + (wp ? ' wrap' : '') },
      fieldsFor(fx, wp).map((f) =>
        stepper({
          label: f.label,
          value: draft[f.prop],
          step: f.step || 1,
          decimal: f.decimal,
          onChange: (v) => {
            draft[f.prop] = v;
            if (f.prop === 'weight' && onWeightChange) onWeightChange();
          },
        }),
      ),
    );
  };

  // Up to three lighter entries after the main one. They are stored and shown, never counted for progress.
  const dropsBlock = (fx, draft) => {
    if (!fx.dropset) return null;
    const drops = draft.drops || (draft.drops = []);
    const rows = drops.map((dr, i) =>
      h(
        'div',
        { class: 'drop' },
        h(
          'div',
          { class: 'drop-head' },
          h('span', { class: 'label' }, `Drop ${i + 1}`),
          h('button', { class: 'drop-x', type: 'button', 'aria-label': `Remove drop ${i + 1}`, onclick: () => (drops.splice(i, 1), notify()) }, icon('x')),
        ),
        h(
          'div',
          { class: 'fields' },
          stepper({ label: 'kg', value: dr.weight, step: fx.step || 1, decimal: true, onChange: (v) => (dr.weight = v) }),
          stepper({ label: 'Reps', value: dr.reps, onChange: (v) => (dr.reps = v) }),
        ),
      ),
    );
    const add =
      drops.length < 3
        ? h(
            'button',
            {
              class: 'drop-add',
              type: 'button',
              onclick: () => {
                const prev = drops.length ? drops[drops.length - 1] : draft;
                drops.push({ weight: dropWeight(fx, prev.weight), reps: prev.reps });
                notify();
              },
            },
            icon('plus'),
            'Drop',
          )
        : null;
    return h('div', { class: 'drops' }, rows, add);
  };

  const hintFor = (fx, draft) => {
    const w = tryWeight(d, session, fx);
    if (!w) return null;
    const btn = h(
      'button',
      {
        class: 'hint',
        type: 'button',
        onclick: () => {
          draft.weight = w;
          draft.reps = fx.repMin;
          notify();
        },
      },
      fx.bodyweight ? `Try +${w}` : `Try ${w}`,
    );
    btn.hidden = !(draft.weight < w);
    return { btn, w };
  };

  // One part of an editor: header (title, hint), steppers, drops.
  const block = (fx, draft, { title }) => {
    const hint = hintFor(fx, draft);
    const body = steppers(fx, draft, () => {
      if (hint) hint.btn.hidden = !(draft.weight < hint.w);
    });
    return h(
      'div',
      { class: 'part' },
      title || hint ? h('div', { class: 'block-head' }, title ? h('span', { class: 'label' }, title) : null, hint ? hint.btn : null) : null,
      body,
      dropsBlock(fx, draft),
    );
  };

  const editorShell = (i, head, children, extra) =>
    h('div', { class: 'set-editor' }, head, ...children, extra || null);

  const activeHead = (i, hint) =>
    h('div', { class: 'head' }, h('div', { class: 'left' }, h('span', { class: 'amber medium' }, isSuper ? `Round ${i}` : `Set ${i}`), hint || null), h('span', { class: 'ring' }));

  const activeRow = (i) => {
    if (!isSuper) {
      const draft = draftFor(ex, i);
      const hint = hintFor(ex, draft);
      const body = steppers(ex, draft, () => {
        if (hint) hint.btn.hidden = !(draft.weight < hint.w);
      });
      return editorShell(i, activeHead(i, hint && hint.btn), [body, dropsBlock(ex, draft)]);
    }
    const entry = byIdx.get(i) || {};
    const part = (fx, label, done) =>
      done
        ? h('div', { class: 'part-done' }, h('span', { class: 'label' }, `${label} · ${fx.name}`), h('span', { class: 'end' }, h('span', { class: 'muted' }, setSummary(fx, done)), checkCircle()))
        : block(fx, draftFor(fx, i), { title: `${label} · ${fx.name}` });
    return editorShell(i, activeHead(i), [part(partA, 'A', entry.A), part(partB, 'B', entry.B)]);
  };

  const editRow = (i) => {
    const entry = byIdx.get(i);
    const head = h(
      'button',
      {
        class: 'head',
        type: 'button',
        'aria-label': `Close ${isSuper ? 'round' : 'set'} ${i}`,
        onclick: () => {
          stopEditing();
          notify();
        },
      },
      h('span', { class: 'amber medium' }, isSuper ? `Round ${i}` : `Set ${i}`),
      checkCircle(),
    );
    const del = h(
      'button',
      {
        class: 'del',
        type: 'button',
        onclick: () => {
          stopEditing();
          drafts.clear();
          deleteSet(sid, card, i);
        },
      },
      isSuper ? 'Delete round' : 'Delete set',
    );
    if (!isSuper) {
      const fx = resolve(card, entry.x.exerciseKey);
      return editorShell(i, head, [block(fx, draftFor(fx, i, entry.x), {})], del);
    }
    return editorShell(
      i,
      head,
      [
        block(partA, draftFor(partA, i, entry.A), { title: `A · ${partA.name}` }),
        block(partB, draftFor(partB, i, entry.B), { title: `B · ${partB.name}` }),
      ],
      del,
    );
  };

  // ---- Rows ----

  const hist = isSuper ? hasHistory(d, session, partA) || hasHistory(d, session, partB) : hasHistory(d, session, ex);

  const summaryOf = (i) => {
    const entry = byIdx.get(i);
    if (isSuper) {
      return h(
        'span',
        { class: 'stack-end' },
        h('span', { class: 'muted' }, `A  ${entry.A ? setSummary(partA, entry.A) : '-'}`),
        h('span', { class: 'muted' }, `B  ${entry.B ? setSummary(partB, entry.B) : '-'}`),
      );
    }
    const fx = resolve(card, entry.x.exerciseKey);
    const other = card.variants && fx.key !== ex.key ? `${fx.variantLabel}: ` : '';
    return h('span', { class: 'muted' }, other + setSummary(fx, entry.x));
  };

  const previewOf = (i) => {
    if (!hist) return '-';
    if (isSuper) {
      return h(
        'span',
        { class: 'stack-end' },
        h('span', {}, `A  ${hasHistory(d, session, partA) ? setSummary(partA, prefill(d, session, partA, i)) : '-'}`),
        h('span', {}, `B  ${hasHistory(d, session, partB) ? setSummary(partB, prefill(d, session, partB, i)) : '-'}`),
      );
    }
    return setSummary(ex, prefill(d, session, ex, i));
  };

  const label = isSuper ? 'Round' : 'Set';
  const rows = [];
  for (let i = 1; i <= card.sets; i++) {
    if (roundDone(i) && editIdx === i) {
      rows.push(editRow(i));
    } else if (roundDone(i)) {
      rows.push(
        h(
          'button',
          {
            class: 'row',
            type: 'button',
            'aria-label': `Edit ${label.toLowerCase()} ${i}`,
            onclick: () => {
              stopEditing();
              editing = { key: editKey, idx: i };
              notify();
            },
          },
          h('span', { class: 'name' }, `${label} ${i}`),
          h('span', { class: 'end' }, summaryOf(i), checkCircle()),
        ),
      );
    } else if (i === activeIdx && editIdx == null) {
      rows.push(activeRow(i));
    } else {
      rows.push(h('div', { class: 'row dim' }, h('span', { class: 'name' }, `${label} ${i}`), h('span', { class: 'end' }, previewOf(i))));
    }
  }

  // ---- Bottom button ----

  const currentRest = rest.active();
  const resting =
    currentRest && currentRest.sessionId === sid && currentRest.exerciseId === card.id && editIdx == null && activeIdx != null;

  const complete = (fx, i, part, startRest) => {
    const values = copy(draftFor(fx, i));
    drafts.delete(draftKey(sid, fx, i));
    logSet(sid, fx, i, values, { startRest, part });
  };

  let bottom;
  let cleanup;
  if (editIdx != null) {
    bottom = h(
      'button',
      {
        class: 'btn-primary',
        type: 'button',
        onclick: () => {
          const entry = byIdx.get(editIdx);
          const targets = isSuper ? [partA, partB] : [resolve(card, entry.x.exerciseKey)];
          for (const fx of targets) {
            const values = copy(draftFor(fx, editIdx, entry[isSuper ? fx.part : 'x']));
            drafts.delete(draftKey(sid, fx, editIdx));
            updateSet(sid, fx, editIdx, values);
          }
          editing = null;
        },
      },
      'Save',
    );
  } else if (resting) {
    const rb = restButton(currentRest, () => rest.clear());
    bottom = rb.el;
    cleanup = rb.stop;
  } else if (activeIdx != null) {
    const text = isSuper ? `Complete set ${activeEntry.A ? 'B' : 'A'}` : `Complete set ${activeIdx}`;
    bottom = h(
      'button',
      {
        class: 'btn-primary',
        type: 'button',
        onclick: () => {
          if (!isSuper) complete(ex, activeIdx, undefined, activeIdx < card.sets);
          else if (!activeEntry.A) complete(partA, activeIdx, 'A', false);
          else complete(partB, activeIdx, 'B', activeIdx < card.sets);
        },
      },
      text,
    );
  } else {
    bottom = h('button', { class: 'btn-primary', type: 'button', onclick: () => back(`/session/${sid}`) }, 'Done');
  }

  // ---- Header ----

  const best = isSuper ? 0 : bestFor(d, ex);
  const variantSwitch =
    !isSuper && card.variants && card.variants.length > 1
      ? segmented({
          label: 'Variant',
          options: card.variants.map((v) => ({ value: v.key, label: v.label })),
          value: ex.key,
          onChange: (key) => {
            stopEditing();
            setVariant(sid, card, key);
          },
        })
      : null;

  const el = h(
    'main',
    { class: 'screen' },
    h(
      'div',
      { class: 'top' },
      iconButton('chevron-left', 'Back', () => {
        stopEditing();
        back(`/session/${sid}`);
      }),
      h('span', { class: 'muted sec' }, `${position} of ${session.exercises.length}`),
    ),
    h('div', { class: 'title-row' }, h('h1', { class: 'title' }, card.name), best > 0 ? h('span', { class: 'pill' }, `Best ${bestShort(ex, best)}`) : null),
    variantSwitch,
    (isSuper ? card.note : ex.note) ? h('p', { class: 'note' }, isSuper ? card.note : ex.note) : null,
    mediaBox(activePart),
    h('section', { class: 'glass list' }, rows),
    h('div', { class: 'bottom' }, bottom),
  );
  return { el, cleanup };
}
