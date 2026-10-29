// Screen 1 (Today) and screen 2 (Choose a session, a sheet over Today).

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { data } from '../store.js';
import { go, back } from '../router.js';
import { weekday } from '../format.js';
import { openSession, nextPlanSession, weekCount, recentSessions } from '../progression.js';
import { startSession } from '../actions.js';
import { underlined, weekBar, sheet } from '../ui.js';

export function today(_params, ctx) {
  const d = data();
  const open = openSession(d);
  const next = open ? null : nextPlanSession(d);

  const label = open ? 'In progress' : 'Next up';
  const name = open ? open.name : next ? next.name : 'No sessions';

  const startOrResume = () => {
    if (open) go(`/session/${open.id}`);
    else if (next) go(`/session/${startSession(next.id)}`);
  };

  const recent = recentSessions(d, 3);

  const el = h(
    'main',
    { class: 'screen has-tabs' },
    h('div', { class: 'top' }, h('h1', { class: 'title' }, 'Today'), weekBar(weekCount(d))),
    h(
      'section',
      { class: 'glass card next-card' },
      h('div', { class: 'label' }, label),
      h('div', { class: 'name' }, underlined(name, ctx.entering)),
      next || open
        ? h('button', { class: 'btn-primary', type: 'button', onclick: startOrResume }, open ? 'Resume session' : 'Start session')
        : null,
    ),
    open
      ? null
      : h(
          'div',
          { class: 'center' },
          h(
            'button',
            { class: 'link', type: 'button', onclick: () => go('/choose') },
            'Choose another session',
            icon('chevron-right'),
          ),
        ),
    h(
      'section',
      { class: 'glass list recent' },
      h('div', { class: 'label' }, 'Recent'),
      recent.length
        ? recent.map((s) =>
            h('div', { class: 'row' }, h('span', { class: 'name' }, s.name), h('span', { class: 'muted' }, weekday(s.finishedAt))),
          )
        : h('div', { class: 'row' }, h('span', { class: 'dim' }, 'No sessions yet')),
    ),
  );
  return { el };
}

export function todayWithChoose(params, ctx) {
  const base = today(params, ctx);
  const d = data();
  const next = nextPlanSession(d);
  const others = d.plan.sessions.filter((s) => !next || s.id !== next.id);

  const subtitle = (s) => (s.exercises.length <= 2 ? joinNames(s.exercises.map((e) => e.name)) : '');

  let sh;
  const choose = (id) => {
    const sid = startSession(id);
    // Replace the sheet entry so back from the session returns to Today.
    go(`/session/${sid}`, { replace: true });
  };
  const rows = h(
    'div',
    { class: 'list-plain' },
    others.map((s, i) =>
      h(
        'button',
        { class: 'row', type: 'button', style: i ? 'border-top:0.5px solid var(--sep)' : '', onclick: () => choose(s.id) },
        h('span', { class: 'name' }, s.name, subtitle(s) ? h('span', { class: 'muted cap', style: 'display:block' }, subtitle(s)) : null),
        icon('chevron-right'),
      ),
    ),
  );
  sh = sheet({
    title: 'Choose a session',
    content: rows,
    animate: ctx.pathChanged,
    onClose: () => back('/'),
  });
  return { el: base.el, overlay: sh.nodes, onEscape: sh.close };
}

function joinNames(names) {
  const lower = names.map((n, i) => (i ? n.charAt(0).toLowerCase() + n.slice(1) : n));
  return lower.join(' and ');
}
