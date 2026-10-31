// Screen 7: session done.

import { h } from '../dom.js';
import { data } from '../store.js';
import { home } from '../router.js';
import { bestLong } from '../format.js';
import { exName } from '../plan.js';
import { newBests, sessionMinutes } from '../progression.js';
import { underlined, iconButton } from '../ui.js';

export function done({ sid }, ctx) {
  const d = data();
  const session = d.sessions.find((s) => s.id === sid);
  if (!session) return { redirect: '/' };
  if (session.status !== 'done') return { redirect: `/session/${sid}` };

  const bests = newBests(d, session);
  const tile = (value, label, accent) =>
    h(
      'div',
      { class: 'tile glass' },
      h('div', { class: 'big' + (accent ? ' amber' : '') }, String(value)),
      h('div', { class: 'label' }, label),
    );

  const el = h(
    'main',
    { class: 'screen' },
    h('div', { class: 'top' }, iconButton('x', 'Close', home)),
    h(
      'div',
      {},
      h('div', { class: 'label', style: 'margin-bottom:6px' }, 'Session done'),
      h('div', { class: 'title' }, underlined(session.name, ctx.entering)),
    ),
    h(
      'div',
      { class: 'tiles' },
      tile(sessionMinutes(session), 'min'),
      tile(session.sets.length, session.sets.length === 1 ? 'set' : 'sets'),
      tile(bests.length, bests.length === 1 ? 'new best' : 'new bests', bests.length > 0),
    ),
    bests.length ? h('div', { class: 'label', style: 'margin-top:6px' }, 'New bests') : null,
    bests.length
      ? h(
          'section',
          { class: 'glass list' },
          bests.map((b) =>
            h(
              'div',
              { class: 'row' },
              h('span', { class: 'name' }, exName(b.ex)),
              h('span', { class: 'end' }, h('span', { class: 'muted' }, bestLong(b.ex, b.value)), h('span', { class: 'pill' }, 'PR')),
            ),
          ),
        )
      : null,
    h('div', { class: 'bottom' }, h('button', { class: 'btn-primary', type: 'button', onclick: home }, 'Done')),
  );
  return { el };
}
