// Default plan (Push, Pull, Leg), preloaded as editable data on first run.
//
// A plan session holds "cards". A card is one entry of the session overview:
//   - a plain exercise (one key),
//   - an exercise with variants (Free / Guided ...): each variant has its own key, so history,
//     bests and the "Last time" line are never mixed,
//   - a superset: two parts, A and B, each with its own key. `sets` is then the number of rounds.
//     (The app supports it, but the default program has none right now.)
//
// Fields (on the card, and on a variant or part where they differ):
//   kind         pullup (clean + partial reps, optional added kg) | easy | weighted | reps | time
//   sets         planned sets (rounds for a superset)
//   repMin/Max   target rep range, shown as a reference only; it drives no logic
//   max          true for "to failure" targets: no range
//   restSec      rest after a set (after the pair for a superset)
//   trackBest    whether the exercise has a Best pill and PRs
//   dropset      a set may carry up to 3 lighter "drop" entries (weighted only)
//   bodyweight   weight is optional added kg, 0 by default (dips, back extension)

const base = (o) => ({
  kind: 'weighted',
  sets: 2,
  repMin: 8,
  repMax: 12,
  max: false,
  restSec: 90,
  trackBest: true,
  note: '',
  ...o,
});

// Plain exercise.
const plain = (slug, name, o = {}) => ({ slug, key: slug, name, ...base(o) });

// Exercise with variants. Each variant: { key, label, ...overrides }.
const withVariants = (group, name, variants, o = {}) => ({
  group,
  name,
  variants: variants.map((v) => ({ slug: v.key, ...v })),
  ...base(o),
});

// Superset: parts are { key, name, ...overrides }.
const superset = (group, name, parts, o = {}) => ({
  group,
  name,
  superset: true,
  parts: parts.map((p) => ({ slug: p.key, ...p })),
  ...base(o),
});

// Pull-ups: clean and partial reps, optional added kg, always to failure. Only clean reps count for records.
const pullups = (slug, name) => plain(slug, name, { kind: 'pullup', repMin: 0, repMax: 0, max: true, restSec: 90, note: 'Only clean reps count for records' });

const TEMPLATES = {
  push: {
    name: 'Push day',
    kind: 'full',
    exercises: [
      plain('incline-machine-press', 'Incline machine press', { repMin: 8, repMax: 12, restSec: 120, note: 'Upper chest' }),
      plain('cable-lateral-raise', 'Cable lateral raise', { repMin: 10, repMax: 15, restSec: 60, dropset: true }),
      withVariants(
        'bench-press',
        'Bench press',
        [
          { key: 'bench-press-free', label: 'Free' },
          { key: 'bench-press-guided', label: 'Guided' },
        ],
        { repMin: 6, repMax: 10, restSec: 150 },
      ),
      plain('shoulder-press-machine', 'Shoulder press machine', { repMin: 8, repMax: 12, restSec: 120 }),
      plain('dips', 'Dips', { repMin: 8, repMax: 12, restSec: 120, bodyweight: true, note: 'Bodyweight, optional added kg' }),
      withVariants(
        'skullcrusher',
        'Skullcrusher',
        [
          { key: 'skullcrusher-cable', label: 'Cable' },
          { key: 'skullcrusher-free', label: 'Free' },
        ],
        { repMin: 10, repMax: 12, restSec: 90 },
      ),
      plain('triceps-pushdown-one-hand', 'Triceps pushdown, one hand', { repMin: 10, repMax: 15, restSec: 60, note: 'per arm' }),
    ],
  },
  pull: {
    name: 'Pull day',
    kind: 'full',
    exercises: [
      pullups('pull-ups-wide', 'Pull-ups, wide grip'),
      plain('cable-rear-delt-fly', 'Cable rear delt fly', { repMin: 12, repMax: 15, restSec: 60 }),
      plain('rowing-machine-wide', 'Rowing machine, wide grip', { repMin: 8, repMax: 12, restSec: 120 }),
      pullups('pull-ups-narrow', 'Pull-ups, narrow grip'),
      plain('back-extension', 'Lower back extension', { repMin: 10, repMax: 15, restSec: 90, bodyweight: true, note: 'Bodyweight, optional added kg' }),
      plain('incline-biceps-curl', 'Seated incline biceps curl', { repMin: 10, repMax: 12, restSec: 75 }),
      plain('hammer-curl', 'Hammer curl', { repMin: 8, repMax: 12, restSec: 75 }),
    ],
  },
  leg: {
    name: 'Leg day',
    kind: 'full',
    exercises: [
      plain('standing-calf-raise', 'Standing calf raise', { repMin: 12, repMax: 15, restSec: 60 }),
      plain('hex-squat', 'Hex squat', { repMin: 6, repMax: 10, restSec: 150, note: 'Hex (trap) bar' }),
      plain('lying-leg-curl', 'Lying leg curl', { repMin: 8, repMax: 12, restSec: 90 }),
      plain('leg-extension', 'Leg extension', { repMin: 10, repMax: 15, restSec: 90 }),
    ],
  },
};

export const DEFAULT_REST = 120;

export function makeExercise(sessionId, tpl) {
  return { ...structuredClone(tpl), id: `${sessionId}.${tpl.group || tpl.slug}` };
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

// Built-in exercise cards offered by Add and Swap.
export const CATALOG = Object.values(TEMPLATES).flatMap((t) => t.exercises);

export function rotationOrder(plan) {
  return plan.sessions.filter((s) => s.kind === 'full');
}

// ---- Cards, variants and parts ----

// Flat exercise objects for a card: one per variant or part, or the card itself.
// Flat objects carry `id` (the card id, used to group sets), `key` (history identity) and `slug` (animation).
export function flatten(card) {
  const { variants, parts, ...rest } = card;
  if (variants) {
    return variants.map((v) => ({ ...rest, ...v, id: card.id, name: card.name, variantLabel: v.label, key: v.key, slug: v.slug || v.key }));
  }
  if (parts) {
    return parts.map((p, i) => ({ ...rest, ...p, id: card.id, superset: true, part: 'AB'[i], key: p.key, slug: p.slug || p.key }));
  }
  return [{ ...rest }];
}

export function resolve(card, key) {
  const flat = flatten(card);
  return flat.find((e) => e.key === key) || flat[0];
}

export const isVariantCard = (card) => Array.isArray(card.variants) && card.variants.length > 1;

// Display name of a flat exercise, with the variant when it has one.
export const exName = (ex) => (ex.variantLabel ? `${ex.name}, ${ex.variantLabel}` : ex.name);
