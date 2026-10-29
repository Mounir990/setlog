// Built-in looping stick-figure animations, used when media/exercises/<slug>.(gif|webp|mp4) is missing.
// White lines on glass. Each entry returns SVG markup for a 360 x 240 canvas.

const STYLE = `
  <style>
    .l { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
    .f { fill: #fff; }
    .paused * { animation-play-state: paused !important; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  </style>`;

// Dead hang: arms straight, then the shoulders pull down and the body rises a little, then relaxes.
const deadHang = `
  <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${STYLE}
    <style>
      .body { animation: hang 3.2s ease-in-out infinite alternate; }
      @keyframes hang { from { transform: translateY(0); } to { transform: translateY(-9px); } }
    </style>
    <defs><clipPath id="below-bar"><rect x="0" y="36" width="360" height="204"/></clipPath></defs>
    <path class="l" d="M92 30 H268"/>
    <g clip-path="url(#below-bar)">
      <g class="body">
        <path class="l" d="M132 0 L158 92 M228 0 L202 92"/>
        <path class="l" d="M158 92 H202"/>
        <circle class="l" cx="180" cy="68" r="15"/>
        <path class="l" d="M180 92 V158"/>
        <path class="l" d="M180 158 L168 222 M180 158 L192 222"/>
      </g>
    </g>
    <circle class="f" cx="132" cy="33" r="6"/><circle class="f" cx="228" cy="33" r="6"/>
  </svg>`;

export const FIGURES = {
  'dead-hang': deadHang,
};
