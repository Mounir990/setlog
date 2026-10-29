// Default plan, preloaded as editable data on first run.
//
// Exercise fields:
//   kind         pullup (strict) | easy (easy pull-ups) | weighted | reps | time
//   sets         planned number of sets
//   repMin/Max   rep range; equal values mean a fixed target. For pull-ups repMin is the starting clean-rep goal.
//   max          true for "max" targets (push-ups, dead hang): no range, no auto goal
//   restSec      rest after a set
//   step         weight step in kg (weighted lifts)
//   progression  strict (pull-up ladder) | double (rep range) | fixed (fixed reps) | none
//   trackBest    whether the exercise has a Best pill and PRs

const E = (slug, name, kind, sets, o = {}) => ({
  slug,
  name,
  kind,
  sets,
  repMin: 0,
  repMax: 0,
  max: false,
  restSec: 90,
  step: 0,
  progression: 'none',
  trackBest: true,
  note: '',
  ...o,
});

const lift = (slug, name, sets, repMin, repMax, restSec, step, o = {}) =>
  E(slug, name, 'weighted', sets, {
    repMin,
    repMax,
    restSec,
    step,
    progression: repMin === repMax ? 'fixed' : 'double',
    ...o,
  });

const pushUps = () => E('push-ups', 'Push-ups', 'reps', 3, { max: true, restSec: 90 });
const easyPullUps = (sets) =>
  E('easy-pull-ups', 'Easy pull-ups', 'easy', sets, {
    repMin: 3,
    repMax: 3,
    restSec: 90,
    trackBest: false,
    note: 'Stop well short of failure',
  });

const TEMPLATES = {
  'upper-back': {
    name: 'Upper back',
    kind: 'full',
    exercises: [
      E('pull-ups', 'Pull-ups', 'pullup', 5, { repMin: 4, repMax: 4, restSec: 150, progression: 'strict' }),
      E('slow-negatives', 'Slow negatives', 'reps', 2, {
        repMin: 3,
        repMax: 3,
        restSec: 90,
        trackBest: false,
        note: '4 to 5 sec down',
      }),
      lift('barbell-row', 'Barbell row', 4, 8, 10, 120, 2.5),
      lift('lat-pulldown', 'Lat pulldown', 3, 8, 12, 90, 2.5, { note: 'Neutral grip' }),
      lift('face-pulls', 'Face pulls', 3, 12, 15, 60, 2.5),
      lift('biceps-curls', 'Biceps curls', 3, 8, 12, 60, 1),
      E('dead-hang', 'Dead hang', 'time', 2, { max: true, restSec: 60 }),
      pushUps(),
    ],
  },
  'upper-front': {
    name: 'Upper front',
    kind: 'full',
    exercises: [
      lift('bench-press', 'Bench press', 4, 6, 8, 150, 2.5),
      lift('overhead-press', 'Overhead press', 3, 8, 8, 120, 2.5),
      lift('incline-dumbbell-press', 'Incline dumbbell press', 3, 10, 10, 90, 2),
      lift('lateral-raises', 'Lateral raises', 3, 12, 15, 60, 1),
      lift('triceps-pushdown', 'Triceps pushdown', 3, 10, 12, 60, 2.5),
      easyPullUps(3),
      pushUps(),
    ],
  },
  legs: {
    name: 'Legs',
    kind: 'full',
    exercises: [
      lift('squat', 'Squat', 4, 6, 8, 150, 5),
      lift('romanian-deadlift', 'Romanian deadlift', 3, 8, 10, 120, 5),
      lift('leg-press', 'Leg press', 3, 10, 12, 90, 5),
      lift('leg-curl', 'Leg curl', 3, 10, 12, 75, 2.5),
      lift('calf-raises', 'Calf raises', 3, 12, 15, 60, 2.5),
      E('ab-wheel', 'Ab wheel', 'reps', 3, { repMin: 8, repMax: 10, restSec: 60 }),
      easyPullUps(2),
      pushUps(),
    ],
  },
  quick: {
    name: 'Quick session',
    kind: 'quick',
    exercises: [easyPullUps(3), pushUps()],
  },
};

export const DEFAULT_REST = 120;

export function makeExercise(sessionId, tpl) {
  return { ...tpl, id: `${sessionId}.${tpl.slug}`, key: tpl.slug };
}

export function defaultPlan() {
  return {
    sessions: Object.entries(TEMPLATES).map(([id, t]) => ({
      id,
      name: t.name,
      kind: t.kind,
      exercises: t.exercises.map((e) => makeExercise(id, e)),
    })),
  };
}

// Built-in exercise list (first template of each slug), used by the editor and animations.
export const CATALOG = (() => {
  const seen = new Map();
  for (const t of Object.values(TEMPLATES)) {
    for (const e of t.exercises) if (!seen.has(e.slug)) seen.set(e.slug, e);
  }
  return [...seen.values()];
})();

export function rotationOrder(plan) {
  return plan.sessions.filter((s) => s.kind === 'full');
}
