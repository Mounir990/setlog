// Screens 4, 5 and 6: exercise (pull-ups, weighted lift, push-ups and the rest state).

import { h } from '../dom.js';
import { data, notify } from '../store.js';
import { go, back } from '../router.js';
import { setSummary, bestShort } from '../format.js';
import {
  setsOf,
  prefill,
  setValues,
  hasHistory,
  tryWeight,
  bestFor,
  pullupGoal,
  historyFor,
} from '../progression.js';
import { logSet, updateSet, deleteSet } from '../actions.js';
import * as rest from '../rest.js';
import { iconButton, stepper, checkCircle, restButton } from '../ui.js';
import { mediaBox } from '../media.js';

// Unsaved stepper values, kept across re-renders: "sessionId:exerciseId:setIndex" -> values.
const drafts = new Map();
// Which logged set is open for editing, if any.
let editing = null;

const draftKey = (sid, ex, i) => `${sid}:${ex.id}:${i}`;

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
        { label: 'kg', prop: 'weight', step: ex.step || 1, decimal: true },
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
  const ex = session.exercises.find((e) => e.id === exId);
  if (!ex) return { redirect: `/session/${sid}` };

  const position = session.exercises.indexOf(ex) + 1;
  const logged = new Map(setsOf(session, ex).map((s) => [s.setIndex, s]));
  const editKey = `${sid}:${exId}`;
  const editIdx = editing && editing.key === editKey ? editing.idx : null;
  const stopEditing = () => {
    if (editIdx != null) drafts.delete(draftKey(sid, ex, editIdx));
    editing = null;
  };

  let activeIdx = null;
  for (let i = 1; i <= ex.sets; i++) {
    if (!logged.has(i)) {
      activeIdx = i;
      break;
    }
  }

  const historyExists = hasHistory(d, session, ex);
  const best = bestFor(d, ex);
  const hintWeight = tryWeight(d, session, ex);
  const weightedPullups =
    ex.kind === 'pullup' &&
    (pullupGoal(d, ex, session.id).weight > 0 || setsOf(session, ex).some((s) => s.weight > 0) || historyFor(d, ex.key, session.id).some((x) => x.sets.some((s) => s.weight > 0)));

  // ---- Rows ----

  const draftFor = (i) => {
    const k = draftKey(sid, ex, i);
    if (!drafts.has(k)) drafts.set(k, logged.has(i) ? setValues(ex, logged.get(i)) : prefill(d, session, ex, i));
    return drafts.get(k);
  };

  const steppers = (draft, onWeightChange) =>
    h(
      'div',
      { class: 'fields' + (weightedPullups ? ' wrap' : '') },
      fieldsFor(ex, weightedPullups).map((f) =>
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

  const activeRow = (i) => {
    const draft = draftFor(i);
    const hint = hintWeight
      ? h(
          'button',
          {
            class: 'hint',
            type: 'button',
            onclick: () => {
              draft.weight = hintWeight;
              draft.reps = ex.repMin;
              notify();
            },
          },
          `Try ${hintWeight}`,
        )
      : null;
    const toggleHint = () => {
      if (hint) hint.hidden = !(draft.weight < hintWeight);
    };
    toggleHint();
    return h(
      'div',
      { class: 'set-editor' },
      h(
        'div',
        { class: 'head' },
        h('div', { class: 'left' }, h('span', { class: 'amber medium' }, `Set ${i}`), hint),
        h('span', { class: 'ring' }),
      ),
      steppers(draft, toggleHint),
    );
  };

  const editRow = (i) => {
    const draft = draftFor(i);
    return h(
      'div',
      { class: 'set-editor' },
      h(
        'button',
        {
          class: 'head',
          type: 'button',
          'aria-label': `Close set ${i}`,
          onclick: () => {
            stopEditing();
            notify();
          },
        },
        h('span', { class: 'amber medium' }, `Set ${i}`),
        checkCircle(),
      ),
      steppers(draft),
      h(
        'button',
        {
          class: 'del',
          type: 'button',
          onclick: () => {
            stopEditing();
            drafts.clear();
            deleteSet(sid, ex, i);
          },
        },
        'Delete set',
      ),
    );
  };

  const rows = [];
  for (let i = 1; i <= ex.sets; i++) {
    if (logged.has(i) && editIdx === i) {
      rows.push(editRow(i));
    } else if (logged.has(i)) {
      rows.push(
        h(
          'button',
          {
            class: 'row',
            type: 'button',
            'aria-label': `Edit set ${i}`,
            onclick: () => {
              stopEditing();
              editing = { key: editKey, idx: i };
              notify();
            },
          },
          h('span', { class: 'name' }, `Set ${i}`),
          h('span', { class: 'end' }, h('span', { class: 'muted' }, setSummary(ex, logged.get(i))), checkCircle()),
        ),
      );
    } else if (i === activeIdx && editIdx == null) {
      rows.push(activeRow(i));
    } else {
      const preview = historyExists ? setSummary(ex, prefill(d, session, ex, i)) : '-';
      rows.push(
        h('div', { class: 'row dim' }, h('span', { class: 'name' }, `Set ${i}`), h('span', { class: 'end' }, preview)),
      );
    }
  }

  // ---- Bottom button ----

  const currentRest = rest.active();
  const resting =
    currentRest && currentRest.sessionId === sid && currentRest.exerciseId === exId && editIdx == null && activeIdx != null;

  let bottom;
  let cleanup;
  if (editIdx != null) {
    bottom = h(
      'button',
      {
        class: 'btn-primary',
        type: 'button',
        onclick: () => {
          const values = { ...draftFor(editIdx) };
          drafts.delete(draftKey(sid, ex, editIdx));
          editing = null;
          updateSet(sid, ex, editIdx, values);
        },
      },
      'Save',
    );
  } else if (resting) {
    const rb = restButton(currentRest, () => rest.clear());
    bottom = rb.el;
    cleanup = rb.stop;
  } else if (activeIdx != null) {
    bottom = h(
      'button',
      {
        class: 'btn-primary',
        type: 'button',
        onclick: () => {
          const values = { ...draftFor(activeIdx) };
          drafts.delete(draftKey(sid, ex, activeIdx));
          logSet(sid, ex, activeIdx, values, { startRest: activeIdx < ex.sets });
        },
      },
      `Complete set ${activeIdx}`,
    );
  } else {
    bottom = h('button', { class: 'btn-primary', type: 'button', onclick: () => back(`/session/${sid}`) }, 'Done');
  }

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
    h(
      'div',
      { class: 'title-row' },
      h('h1', { class: 'title' }, ex.name),
      best > 0 ? h('span', { class: 'pill' }, `Best ${bestShort(ex, best)}`) : null,
    ),
    ex.note ? h('p', { class: 'note' }, ex.note) : null,
    mediaBox(ex),
    h('section', { class: 'glass list' }, rows),
    h('div', { class: 'bottom' }, bottom),
  );
  return { el, cleanup };
}
