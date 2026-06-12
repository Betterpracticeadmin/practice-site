// demo.mjs — runs the PRACTICE OS drive graph over a full "one drive cycle".
// Run:  node agent-os/demo.mjs
//
// Six phases (init → urban → CRITICAL cut-in → optimization → cruise → end),
// each frame pushed through the 9-node graph. Prints a readable trace + latency.

import { buildDriveGraph } from './graph.mjs';
import { newDriveState, LATENCY_BUDGET_MS } from './drive_state.mjs';

const g = buildDriveGraph();
const t0 = 0;

// scripted frames (synthetic sensor input). distance in m, rel_v<0 = closing.
const frames = [
  { phase: 'INIT',    speed: 0,    accel: 0,   heading: 90, steering: 0,    entities: [] },
  { phase: 'URBAN',   speed: 11,   accel: 1.0, heading: 90, steering: 0.05, entities: [{ type: 'vehicle', distance: 40, rel_v: -2, lane: 0 }, { type: 'pedestrian', distance: 22, rel_v: 0, lane: 1 }] },
  { phase: 'URBAN',   speed: 13,   accel: 0.4, heading: 92, steering: 0.10, entities: [{ type: 'vehicle', distance: 30, rel_v: -3, lane: 0 }] },
  { phase: 'CUT-IN',  speed: 14,   accel: 0.0, heading: 92, steering: 0.0,  yaw_rate: 4, entities: [{ type: 'vehicle', distance: 8, rel_v: -9, lane: 0 }] }, // sudden cut-in, fast closing
  { phase: 'OPTIM',   speed: 7,    accel: -2,  heading: 92, steering: -0.05, entities: [{ type: 'vehicle', distance: 24, rel_v: -1, lane: 0 }] },
  { phase: 'CRUISE',  speed: 22,   accel: 0.6, heading: 95, steering: 0.0,  road: 'highway', entities: [{ type: 'vehicle', distance: 70, rel_v: 0, lane: 1 }] },
  { phase: 'CRUISE',  speed: 24,   accel: 0.2, heading: 95, steering: 0.0,  road: 'highway', entities: [] },
  { phase: 'END',     speed: 0,    accel: -3,  heading: 95, steering: 0.0,  entities: [] },
];

const pad = (s, n) => String(s).padEnd(n);
const bar = (x, n = 10) => '█'.repeat(Math.round(x * n)).padEnd(n, '·');

console.log('\n  PRACTICE OS — drive graph execution  (9 nodes · safety-override · async logger)\n');
console.log('  ' + pad('PHASE', 8) + pad('v km/h', 8) + pad('RISK', 17) + pad('LEVEL', 10) + pad('CONTROL thr/brk/str', 22) + pad('TWIN', 11) + 'VOICE');
console.log('  ' + '─'.repeat(110));

let last, twin, trace = [];
for (let i = 0; i < frames.length; i++) {
  const fr = frames[i];
  const st = newDriveState({ ...fr, t: t0 + i * 1000, t0, night: false });
  if (twin) st.driver_twin = twin;   // carry the human model forward (continuous loop)
  st.events = trace;                 // carry the replay trace
  last = await g.invoke(st);
  twin = last.driver_twin; trace = last.events;
  const u = last.ui, c = last.control;
  const ctrl = `${c.throttle.toFixed(2)}/${c.brake.toFixed(2)}/${c.steering.toFixed(2)}`;
  console.log('  ' +
    pad(fr.phase, 8) +
    pad((last.sensor_frame.speed * 3.6).toFixed(0), 8) +
    pad(bar(last.risk_score) + ' ' + last.risk_score.toFixed(2), 17) +
    pad(u.state, 10) +
    pad(ctrl, 22) +
    pad(last.driver_twin.state, 11) +
    (u.voice ? '🔊 ' + u.voice : '· ' + u.primary));
}

console.log('\n  Per-node latency (last tick, ms) — prototype reasoning layer vs production budget:');
const tm = last._timings;
for (const k of Object.keys(tm)) {
  console.log('   ' + pad(k, 13) + pad(tm[k] + ' ms', 12) + 'budget ' + (LATENCY_BUDGET_MS[k] ?? 0) + ' ms');
}
const total = Object.values(tm).reduce((a, b) => a + b, 0);
const budget = Object.values(LATENCY_BUDGET_MS).reduce((a, b) => a + b, 0);
console.log('   ' + pad('TOTAL', 13) + pad(total.toFixed(2) + ' ms', 12) + 'budget ~' + budget + ' ms (Rust/NATS target, closed loop)');

console.log('\n  Trace log (async logger node, replayable):');
last.events.forEach((e) => console.log('   t=' + e.t + 'ms  risk=' + e.risk + '  ' + e.state + '  brk=' + e.ctrl.brake + '  reason=' + e.reason));
console.log('');
