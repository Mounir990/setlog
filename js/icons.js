// Tabler Icons (outline set, MIT licence), inlined so the app works offline.
// Each entry is the inner markup of a 24x24 stroke icon.
const PATHS = {
  "home": `<path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />`,
  "chart-line": `<path d="M4 19l16 0" /><path d="M4 15l4 -6l4 2l4 -5l4 4" />`,
  "list": `<path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" />`,
  "chevron-left": `<path d="M15 6l-6 6l6 6" />`,
  "chevron-right": `<path d="M9 6l6 6l-6 6" />`,
  "plus": `<path d="M12 5l0 14" /><path d="M5 12l14 0" />`,
  "minus": `<path d="M5 12l14 0" />`,
  "check": `<path d="M5 12l5 5l10 -10" />`,
  "x": `<path d="M18 6l-12 12" /><path d="M6 6l12 12" />`,
  "clock": `<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" />`,
  "player-play": `<path d="M7 4v16l13 -8l-13 -8" />`,
  "grip-vertical": `<path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />`,
};

export function icon(name) {
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return span;
}
