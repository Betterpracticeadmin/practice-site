// nodes.mjs — the 9 stateful agent nodes.
// Each node: (state) => partialPatch. Real logic, not stubs. Pure & deterministic per tick.

import { RISK } from './drive_state.mjs';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* 1. SensorNode — normalises raw CAN/GPS/vision into a timestamped frame */
export function sensorNode(s) {
  const r = s._raw;
  return {
    sensor_frame: {
      t: s._t,
      speed: r.speed ?? 0,            // m/s
      accel: r.accel ?? 0,            // m/s^2 (longitudinal)
      heading: r.heading ?? 0,        // deg
      steering: r.steering ?? 0,      // [-1,1]
      yaw_rate: r.yaw_rate ?? 0,      // deg/s
      entities: r.entities ?? [],     // [{type, distance(m), rel_v(m/s, neg=closing), lane}]
      env: { road: r.road ?? 'urban', weather: r.weather ?? 'clear', visibility: r.visibility ?? 1 },
    },
  };
}

/* 2. PerceptionNode — object/lane classification + semantic map */
export function perceptionNode(s) {
  const f = s.sensor_frame;
  const objects = f.entities.map((e, i) => ({
    id: i, type: e.type, distance: e.distance, rel_v: e.rel_v,
    lane: e.lane ?? 0, closing: e.rel_v < 0,
  }));
  return {
    world_model: {
      road_type: f.env.road,
      lane: { id: 0, width: f.env.road === 'highway' ? 3.6 : 3.0, offset: f.steering * 0.4 },
      objects,
      visibility: f.visibility,
      grip: f.env.weather === 'rain' ? 0.72 : f.env.weather === 'snow' ? 0.5 : 0.95,
    },
  };
}

/* 3. PredictionNode — 3–5 s trajectory forecast + intent inference */
export function predictionNode(s) {
  const f = s.sensor_frame, w = s.world_model, H = 4.0; // horizon seconds
  const predicted = w.objects.map((o) => {
    const closeIn = o.closing ? o.distance / Math.max(-o.rel_v, 0.1) : Infinity;
    return { id: o.id, ttc: closeIn, future_distance: o.distance + o.rel_v * H, lane: o.lane };
  });
  // ego intent from steering + speed trend
  let ego = 'lane_keep';
  if (Math.abs(f.steering) > 0.25) ego = f.steering > 0 ? 'turn_right' : 'turn_left';
  else if (f.accel < -1.5) ego = 'brake';
  else if (f.accel > 1.2) ego = 'accelerate';
  return { intent: { ego, horizon_s: H, predicted } };
}

/* 4. DriverTwinNode — human model (fatigue/aggression/reaction), same math as the cockpit twin */
export function driverTwinNode(s) {
  const f = s.sensor_frame, prev = s.driver_twin;
  const spdK = f.speed * 3.6;
  const gLon = f.accel / 9.81, gLat = Math.abs((f.yaw_rate * Math.PI / 180) * f.speed) / 9.81;
  const inst = 100 - Math.min(1, Math.abs(gLon) / 0.5) * 55 - Math.min(1, gLat / 0.7) * 35;
  const smooth = (prev.smooth ?? 82) * 0.93 + Math.max(0, inst) * 0.07;
  const ia = Math.min(100, (Math.max(0, Math.abs(gLon) - 0.18) / 0.5 + Math.max(0, gLat - 0.3) / 0.6) * 100);
  const aggression = prev.aggression * 0.92 + ia * 0.08;
  const mins = (s._t - (s._raw.t0 ?? s._t)) / 60000;
  const fatigue = clamp(4 + mins * 0.42 + (s._raw.night ? 16 : 0), 0, 100);
  const focus = Math.max(20, 100 - aggression * 0.35 - Math.max(0, fatigue - 40) * 0.6);
  const reaction_time = clamp(0.7 + fatigue / 130 + aggression / 400, 0.55, 1.6); // seconds
  let state = 'calm';
  if (gLat > 0.55 || aggression > 55) state = 'aggressive';
  else if (fatigue > 62) state = 'fatigued';
  else if (aggression > 34 || spdK > 110) state = 'stressed';
  else if (spdK > 30 && smooth > 72) state = 'focused';
  return { driver_twin: { smooth, aggression, fatigue, focus, reaction_time, state } };
}

/* 5. RiskEngineNode — fusion: Risk(t) = Σ P(collision_i) · Impact_i, adjusted by driver reaction & grip */
export function riskEngineNode(s) {
  const pred = s.intent.predicted ?? [];
  const tw = s.driver_twin, grip = s.world_model.grip ?? 0.95;
  const tau = 2.5; // s — TTC sensitivity
  let risk = 0;
  for (const p of pred) {
    if (!isFinite(p.ttc)) continue;
    // effective TTC shrinks with driver reaction time and poor grip
    const ttcEff = Math.max(0.05, p.ttc - tw.reaction_time) * grip;
    const pColl = clamp(Math.exp(-ttcEff / tau), 0, 1);
    const impact = clamp(1 - p.future_distance / 60, 0.2, 1); // closer future = higher impact
    risk += pColl * impact;
  }
  risk = clamp(risk + Math.max(0, s.sensor_frame.speed * 3.6 - 130) / 200, 0, 1);
  return { risk_score: risk, safety_override: risk >= RISK.P0 };
}

/* 6. PlannerNode — MPC-lite: pick target speed + steer from risk, intent, grip */
export function plannerNode(s) {
  const f = s.sensor_frame, risk = s.risk_score, grip = s.world_model.grip ?? 0.95;
  let target_speed = f.speed;
  if (s.safety_override) target_speed = 0;                       // emergency
  else if (risk > RISK.P1) target_speed = f.speed * (1 - risk * 0.6);
  else target_speed = Math.min(f.speed + 1.5, f.speed * 1.05 + 0.5); // gentle resume
  const target_steer = clamp(-s.world_model.lane.offset / 0.4, -1, 1) * grip;
  const waypoints = Array.from({ length: 4 }, (_, i) => ({
    t: (i + 1) * 1.0,
    v: target_speed,
    s: target_steer,
  }));
  return { trajectory: { target_speed, target_steer, waypoints, reason: s.safety_override ? 'P0_emergency' : risk > RISK.P1 ? 'risk_decel' : 'cruise' } };
}

/* 7. ControlNode — actuation commands, clamped & smoothed */
export function controlNode(s) {
  const f = s.sensor_frame, tr = s.trajectory;
  const dv = tr.target_speed - f.speed;
  let throttle = 0, brake = 0;
  if (s.safety_override) { brake = 1; throttle = 0; }
  else if (dv > 0.1) throttle = clamp(dv / 4, 0, 1);
  else if (dv < -0.1) brake = clamp(-dv / 5, 0, 1);
  const steering = clamp((s.control.steering ?? 0) * 0.5 + tr.target_steer * 0.5, -1, 1); // smoothing
  return { control: { steering: +steering.toFixed(3), throttle: +throttle.toFixed(3), brake: +brake.toFixed(3) } };
}

/* 8. UINode — HUD fields + voice events with a strict priority stack */
export function uiNode(s) {
  const f = s.sensor_frame, risk = s.risk_score, tw = s.driver_twin;
  const level = s.safety_override ? 'CRITICAL' : risk > RISK.P1 ? 'ALERT' : 'SAFE';
  // priority stack: 1 Safety > 2 Navigation > 3 Optimization > 4 Commentary
  const candidates = [];
  if (s.safety_override) candidates.push({ p: 1, voice: 'Freinage. Véhicule sur la trajectoire.', primary: 'FREINE' });
  if (s.intent.ego === 'turn_left' || s.intent.ego === 'turn_right') candidates.push({ p: 2, voice: null, primary: s.intent.ego === 'turn_left' ? 'Virage gauche' : 'Virage droite' });
  if (!s.safety_override && risk < RISK.P1 && s.trajectory.reason === 'cruise' && f.accel > 0.5) candidates.push({ p: 3, voice: 'Tu peux relâcher, route dégagée.', primary: 'Relâche' });
  if (tw.state === 'fatigued') candidates.push({ p: 2.5, voice: 'Signes de fatigue, prévois une pause.', primary: 'Fatigue détectée' });
  candidates.push({ p: 4, voice: null, primary: { calm: 'Tout roule.', focused: 'Concentré.', stressed: 'Reste souple.', aggressive: 'Du calme.', fatigued: 'Repose-toi bientôt.' }[tw.state] });
  candidates.sort((a, b) => a.p - b.p);
  const top = candidates[0];
  return {
    ui: {
      state: level,
      primary: top.primary,
      voice: top.voice,                 // null = no speech this tick (event-triggered)
      hud: {
        speed_vector: { mag: +(f.speed * 3.6).toFixed(0), dir: f.heading },
        risk_field: +risk.toFixed(2),   // 0..1 → heatmap intensity
        grip: s.world_model.grip,
        ghosts: (s.intent.predicted ?? []).filter((p) => isFinite(p.ttc)).length,
        driver_state: tw.state,
      },
      actions: s.safety_override ? ['emergency_brake'] : risk > RISK.P1 ? ['prepare_brake', 'increase_gap'] : [],
    },
  };
}

/* 9. LoggerNode — async, non-blocking trace append (replay system) */
export async function loggerNode(s) {
  // simulate async sink (would be NATS/Kafka in production) without blocking the control loop
  await Promise.resolve();
  const rec = { t: s._t, risk: +s.risk_score.toFixed(2), state: s.ui.state, ctrl: s.control, twin: s.driver_twin.state, reason: s.trajectory.reason };
  return { events: [...s.events, rec] };
}
