// Progress and Plan tabs. Their content arrives in phase 2; the tab bar is complete now.

import { h } from '../dom.js';

function stub(title, text) {
  return () => ({
    el: h(
      'main',
      { class: 'screen has-tabs' },
      h('h1', { class: 'title' }, title),
      h('p', { class: 'stub' }, text),
    ),
  });
}

export const progress = stub('Progress', 'Charts and bests are coming in the next build.');
export const plan = stub('Plan', 'Editing sessions and backups are coming in the next build.');
