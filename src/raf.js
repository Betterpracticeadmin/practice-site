// ═══════════════════════════════════════════════════════════════
// src/raf.js — the ONE requestAnimationFrame loop for the whole app.
// Subscribers get (t, dt). Auto-stops when the last subscriber leaves
// (true 0 CPU at idle). Lenis is driven from here (its autoRaf is off).
// ═══════════════════════════════════════════════════════════════
const subs = new Set();
let running = false, last = 0, id = 0;
function tick(t) {
  const dt = last ? t - last : 16.7; last = t;
  for (const fn of subs) fn(t, dt);
  id = requestAnimationFrame(tick);
}
export function addFrame(fn) {
  subs.add(fn);
  if (!running) { running = true; last = 0; id = requestAnimationFrame(tick); }
  return () => {
    subs.delete(fn);
    if (subs.size === 0) { cancelAnimationFrame(id); running = false; }
  };
}
