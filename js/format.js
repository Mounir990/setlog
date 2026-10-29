// Text formatting helpers shared by the screens.

export const num = (n) => String(Math.round(n * 100) / 100);

export function setSummary(ex, s) {
  switch (ex.kind) {
    case 'pullup':
    case 'easy':
      return (
        `${s.cleanReps} clean` + (s.partialReps ? `, ${s.partialReps} part.` : '') + (s.weight > 0 ? `, +${num(s.weight)} kg` : '')
      );
    case 'weighted':
      return `${num(s.weight)} kg x ${s.reps}`;
    case 'time':
      return `${s.seconds} s`;
    default:
      return `${s.reps} reps`;
  }
}

// Value shown in the "Best" pill and PR list.
export function bestShort(ex, v) {
  return ex.kind === 'time' ? `${num(v)} s` : num(v);
}

export function bestLong(ex, v) {
  switch (ex.kind) {
    case 'pullup':
    case 'easy':
      return `${num(v)} clean`;
    case 'weighted':
      return `${num(v)} kg`;
    case 'time':
      return `${num(v)} s`;
    default:
      return `${num(v)} reps`;
  }
}

export function targetLabel(ex) {
  if (ex.max) return `${ex.sets} x max`;
  if (ex.repMin === ex.repMax) return `${ex.sets} x ${ex.repMin}`;
  return `${ex.sets} x ${ex.repMin}-${ex.repMax}`;
}

export function clock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function weekday(ts) {
  return new Date(ts).toLocaleDateString('en', { weekday: 'short' });
}

export function dayLabel(ts) {
  return new Date(ts).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function shortDate(ts) {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

const same = (arr) => arr.every((x) => x === arr[0]);

// One line describing what was done in a session, for the exercise progress list.
export function sessionSummary(ex, sets) {
  switch (ex.kind) {
    case 'pullup':
    case 'easy': {
      const clean = sets.map((s) => s.cleanReps || 0);
      const part = sets.reduce((n, s) => n + (s.partialReps || 0), 0);
      const w = Math.max(0, ...sets.map((s) => s.weight || 0));
      const main = same(clean) ? `${clean.length} x ${clean[0]} clean` : `${clean.join(', ')} clean`;
      return main + (part ? `, ${part} part.` : '') + (w ? ` at +${num(w)} kg` : '');
    }
    case 'weighted': {
      const weights = sets.map((s) => s.weight || 0);
      const reps = sets.map((s) => s.reps || 0);
      if (same(weights)) {
        return same(reps) ? `${num(weights[0])} kg, ${reps.length} x ${reps[0]}` : `${num(weights[0])} kg x ${reps.join(', ')}`;
      }
      return sets.map((s) => `${num(s.weight || 0)} x ${s.reps || 0}`).join(', ') + ' kg';
    }
    case 'time':
      return `${sets.map((s) => s.seconds || 0).join(', ')} s`;
    default: {
      const reps = sets.map((s) => s.reps || 0);
      return same(reps) ? `${reps.length} x ${reps[0]}` : `${reps.join(', ')} reps`;
    }
  }
}

export function goalLabel(g) {
  return `${g.sets} x ${g.reps}` + (g.weight > 0 ? ` at +${num(g.weight)} kg` : '');
}

export function ago(ts) {
  if (!ts) return 'never';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
