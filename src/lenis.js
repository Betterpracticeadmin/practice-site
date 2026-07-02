// ═══════════════════════════════════════════════════════════════
// src/lenis.js — module singleton handle so Loader / RouteTransition /
// ScrollToTop can reach Lenis WITHOUT a window global or prop-drill.
// ═══════════════════════════════════════════════════════════════
let _lenis = null;
export function setLenis(l) { _lenis = l; }
export function getLenis() { return _lenis; }
