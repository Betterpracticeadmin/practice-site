# PRACTICE OS — Unreal Engine truth layer (Blueprint spec)

Unreal is the **physics truth layer**: everything the AI "believes it sees" originates here.
This document is the production reference. The runnable web equivalent of this loop lives in
`public/hud.html` (a synthetic world sim driving the same agent logic) — that is what you can
test live today; Unreal itself needs the Editor + a vehicle/world project.

## Real-time loop (Event Tick, 60 Hz)

```
EVENT TICK (60Hz)
  → [WORLD STATE CAPTURE]  actors · traffic · lane splines · weather
  → [SENSOR EMULATION]     SceneCapture2D (RGB) · LiDAR sphere-trace · radar Doppler
  → [NOISE INJECTION]      gaussian + motion blur + latency shift (rain/fog/vibration)
  → [SENSOR PACKAGER]      → SensorFrame struct (protobuf/flatbuffers)
  → [AI BRIDGE]            UDP/NATS → Rust/Python runtime, await ControlCommand (<30ms)
  → [PHYSICS APPLY]        VehicleMovementComponent (steer/throttle/brake)
  → [HUD RENDER]
```

The `SensorFrame` and `ControlCommand` schemas match `agent-os/drive_state.mjs`
(`sensor_frame` and `control`) so the same graph consumes Unreal frames or live GPS frames.

## Blueprint nodes

| Node | Role | Key ops |
|---|---|---|
| **BP_WorldCapture** | scene snapshot | `GetAllActorsOfClass(Vehicle/Pedestrian)`, lane spline sample, road curvature |
| **BP_SensorSim** | emulate sensors | SceneCapture2D→RenderTarget; 360° sphere-trace grid → point cloud; Doppler velocity |
| **BP_NoiseInject** | realism | `value += gaussian(σ_weather) + motion_blur + latency_shift` |
| **BP_AIBridge** | transport | serialize → send UDP/NATS → async receive `ControlCommand` |
| **BP_ControlApply** | actuation | `Steering=Lerp(cur,AI_Steer,0.2)`, `Throttle=Smooth(AI_Throttle)`, `Brake=AI_Brake` |
| **BP_HUD** | overlay | speed vector, risk field, prediction ghosts, driver panel |

## Sub-graph — Traffic AI (Behavior Tree)

```
BT_TrafficAgent
 ├── Selector
 │    ├── [Service] SenseRiskField (read shared risk grid)
 │    ├── Sequence: FollowLane → KeepDistance → MatchFlowSpeed
 │    ├── Sequence(if gap & faster lane): SignalIntent → Overtake
 │    └── Sequence(if pedestrian crossing): Decelerate → Yield
 └── Spawn Manager: density by LOD, despawn behind camera
```

## Real-time constraints

| Stage | Budget | Note |
|---|---|---|
| Sensor tick | 60 Hz | locked |
| AI inference | 20–40 ms | over the bridge |
| Physics sync | 60 Hz | locked |
| Frame desync compensation | mandatory | timestamp every frame, interpolate control |

## Honest boundary

- **Real here:** the loop topology, the SensorFrame/ControlCommand contract, and the agent
  graph that consumes it (`agent-os/`, runnable in Node) — plus the web HUD that simulates the
  whole thing visually (`hud.html`).
- **Needs Unreal + assets (not in this repo):** the actual Blueprints, ray-traced LiDAR,
  shaders, vehicle physics, traffic crowds. This file is the build spec a team follows in-Editor.
```
```
