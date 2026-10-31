// Screen 3: session overview.

import { h } from '../dom.js';
import { data } from '../store.js';
import { go, back, home } from '../router.js';
import { exerciseState, currentExercise, chosenKey } from '../progression.js';
import { finishSession } from '../actions.js';
import { underlined, iconButton, checkCircle } from '../ui.js';

export function overview({ sid }, ctx) {
  const d = data();
  const session = d.sessions.find((s) => s.id === sid);
  if (!session) return { redirect: '/' };
  if (session.status === 'done') return { redirect: `/done/${sid}` };

  const current = currentExercise(session);
  const total = session.exercises.length;
  const pos = current ? session.exercises.indexOf(current) + 1 : total;

  const finish = () => {
    if (finishSession(sid)) go(`/done/${sid}`, { replace: true });
    else home();
  };

  const rows = session.exercises.map((ex) => {
    const st = exerciseState(session, ex);
    const isCurrent = current && ex.id === current.id;
    let end;
    if (st.done) end = checkCircle();
    else if (st.logged > 0) end = h('span', { class: isCurrent ? 'muted sec' : 'sec' }, `${st.logged} of ${st.total}`);
    else end = h('span', { class: 'sec' }, `${st.total} ${ex.parts ? 'rounds' : st.total === 1 ? 'set' : 'sets'}`);
    // Second line: the variant in use, or the superset parts.
    let sub = '';
    if (ex.parts) sub = 'Superset';
    else if (ex.variants && ex.variants.length > 1) {
      const key = chosenKey(d, session, ex);
      sub = (ex.variants.find((v) => v.key === key) || ex.variants[0]).label;
    }
    return h(
      'button',
      {
        class: 'row' + (isCurrent ? ' active' : '') + (!st.done && !isCurrent ? ' dim' : ''),
        type: 'button',
        onclick: () => go(`/session/${sid}/${ex.id}`),
      },
      h(
        'span',
        { class: 'name' + (isCurrent ? ' amber medium' : '') },
        ex.name,
        sub ? h('span', { class: 'cap block ' + (isCurrent ? 'muted' : '') }, sub) : null,
      ),
      h('span', { class: 'end' }, end),
    );
  });

  const el = h(
    'main',
    { class: 'screen' },
    h(
      'div',
      { class: 'top' },
      iconButton('chevron-left', 'Back', () => back('/')),
      h('span', { class: 'muted sec' }, `${pos} of ${total}`),
    ),
    h('h1', { class: 'title', style: 'margin-bottom:8px' }, underlined(session.name, ctx.entering)),
    h('section', { class: 'glass list' }, rows),
    h(
      'div',
      { class: 'bottom' },
      h('button', { class: 'btn-primary', type: 'button', onclick: finish }, 'Finish session'),
    ),
  );
  return { el };
}
