// Text formatting helpers shared by the screens.

export const num = (n) => String(Math.round(n * 100) / 100);

export function setSummary(ex, s) {
  switch (ex.kind) {
    case 'pullup':
    case 'easy':
      return `${s.cleanReps} clean` + (s.partialReps ? `, ${s.partialReps} part.` : '');
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
