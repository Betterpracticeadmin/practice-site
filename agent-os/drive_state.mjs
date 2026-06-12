// drive_state.mjs — global state shared by every agent node (mirrors the LangGraph DriveState)
//
// In LangGraph this is a TypedDict; here it is a plain object produced by a factory.
// Every node receives the whole state and returns a PARTIAL patch that the engine merges in.

/**
 * @typedef {Object} DriveState
 * @property {Object} sensor_frame  raw + timestamped sensor snapshot (speed, accel, heading, steering, entities, env)
 * @property {Object} world_model   perception output: road type, classified objects, lane model
 * @property {Object} driver_twin   human model: fatigue, aggression, reaction_time, focus, state
 * @property {number} risk_score    fused collision risk in [0,1]
 * @property {Object} intent        ego + others intent inference + predicted paths
 * @property {Object} trajectory    planned waypoints + target speed/steer
 * @property {Object} control       actuation: steering [-1,1], throttle [0,1], brake [0,1]
 * @property {Object} ui            HUD + voice events for the cockpit
 * @property {Array}  events        append-only trace log (replay)
 * @property {boolean} safety_override  set by the risk node when P0 danger is detected
 */

export function newDriveState(rawInput = {}) {
  return {
    sensor_frame: {},
    world_model: {},
    driver_twin: { fatigue: 6, aggression: 12, focus: 86, reaction_time: 0.9, state: 'calm' },
    risk_score: 0,
    intent: {},
    trajectory: {},
    control: { steering: 0, throttle: 0, brake: 0 },
    ui: {},
    events: [],
    safety_override: false,
    _raw: rawInput,        // raw sensor input for this tick
    _t: rawInput.t || 0,   // tick timestamp (ms) — passed in, never Date.now (keeps runs reproducible)
  };
}

// Risk thresholds (collision probability fusion → discrete escalation)
export const RISK = { P1: 0.45, P0: 0.8 };

// Production latency budget (documented target for the Rust/NATS substrate, NOT this JS prototype)
export const LATENCY_BUDGET_MS = {
  sensor: 8, perception: 22, prediction: 18, driver_twin: 6,
  risk: 8, planner: 26, control: 8, ui: 14, logger: 0, // logger is async/non-blocking
};
