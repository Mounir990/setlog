// Hash routes on top of the History API, so the phone's back gesture works and no server rewrites are needed.
// Each history entry carries its depth in state.i, which lets the in-app back button fall back
// to a parent route when the app was opened directly on a deep link.

let onChange = () => {};

export function path() {
  const p = location.hash.slice(1);
  return p || '/';
}

export function init(cb) {
  onChange = cb;
  if (!history.state || typeof history.state.i !== 'number') {
    history.replaceState({ i: 0 }, '', location.hash || '#/');
  }
  window.addEventListener('popstate', () => onChange());
}

export function go(to, { replace = false } = {}) {
  const i = (history.state && history.state.i) || 0;
  if (replace) history.replaceState({ i }, '', '#' + to);
  else history.pushState({ i: i + 1 }, '', '#' + to);
  onChange();
}

export function back(fallback = '/') {
  if ((history.state && history.state.i) > 0) history.back();
  else go(fallback, { replace: true });
}

// Return to the first entry of this app visit (Today), dropping the screens above it.
export function home() {
  const i = (history.state && history.state.i) || 0;
  if (i > 0) {
    history.go(-i);
    setTimeout(() => {
      if (path() !== '/') go('/', { replace: true });
    }, 200);
  } else {
    go('/', { replace: true });
  }
}

// Match "/session/:sid/:exId" style patterns.
export function match(pattern, p) {
  const a = pattern.split('/');
  const b = p.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
