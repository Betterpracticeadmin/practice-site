# PRACTICE OS — Agent Graph (real execution core)

The multi-agent **drive cognition graph**: 9 stateful nodes orchestrated by a global
state machine, with a Safety override and an async logger. This is the structuring core
of the OS — the part that turns the cockpit from an assistant into a system.

Two implementations, **identical topology**:

| File | Role | Runnable here |
|---|---|---|
| `langgraph_reference.py` | Canonical **LangGraph** implementation (production reference) | needs `pip install langgraph` |
| `graph.mjs` + `nodes.mjs` + `drive_state.mjs` | **Runnable Node twin** — same nodes/edges, pure stdlib | ✅ `node agent-os/demo.mjs` |
| `server.mjs` | SSE/REST bridge so the cockpit consumes real graph output | ✅ `node agent-os/server.mjs` |

## Run it

```bash
node agent-os/demo.mjs        # full one-drive-cycle trace (incl. CRITICAL cut-in)
node agent-os/server.mjs      # http://localhost:8787/stream (SSE) · POST /tick · /health
```

## Graph

```
            ┌────────┐
            │ sensor │ (entry)
            └───┬────┘
        ┌───────┴────────┐
        ↓                ↓
  ┌───────────┐    ┌────────────┐
  │perception │    │driver_twin │
  └─────┬─────┘    └──────┬─────┘
        ↓                 │
  ┌────────────┐          │
  │ prediction │          │
  └─────┬──────┘          │
        └────────┬────────┘
                 ↓
            ┌────────┐
            │  risk  │  Risk(t)=Σ P(collision_i)·Impact_i   → safety_override if ≥ P0
            └───┬────┘
                ↓
           ┌─────────┐
           │ planner │  MPC-lite: target speed/steer (emergency = full stop)
           └────┬────┘
                ↓
           ┌─────────┐
           │ control │  steering/throttle/brake, clamped & smoothed
           └────┬────┘
                ↓
           ┌────┐   side edges (non-blocking): perception, risk, planner, driver_twin → ui
           │ ui │   HUD fields + voice (priority: Safety > Nav > Optimization > Commentary)
           └─┬──┘
             ↓
        ┌────────┐
        │ logger │  async, non-blocking — replayable trace
        └────────┘
```

Edges are **data dependencies**; the engine runs nodes in topological order, so `risk`
fires only after both `prediction` and `driver_twin`. `ui` is fed by side edges (read-only
perception layer); `logger` is async.

## The 9 nodes

1. **sensor** — normalises raw CAN/GPS/vision into a timestamped frame.
2. **perception** — object/lane classification, semantic map, grip estimate.
3. **prediction** — 3–5 s trajectory forecast + ego intent inference.
4. **driver_twin** — human model (fatigue, aggression, reaction time, focus, state) from dynamics. *Same math as the cockpit's "Jumeau du conducteur".*
5. **risk** — fusion engine: `Risk(t)=Σ P(collision_i)·Impact_i`, shrunk by driver reaction time and grip.
6. **planner** — MPC-lite target speed/steer; emergency stop on P0.
7. **control** — actuation commands, clamped & smoothed.
8. **ui** — HUD + voice with a strict priority stack.
9. **logger** — async trace sink (replay).

## Latency

Prototype reasoning layer (this Node engine) runs the full 9-node tick in **~0.1 ms**.
The numbers in `LATENCY_BUDGET_MS` are the **production target** for the real substrate
(Rust hot path + NATS), closed loop ≈ **110 ms** sensor→actuation.

## Honest boundary (what's real vs. what's the production substrate)

**Real and running here:**
- The full multi-agent graph: state, 9 nodes, topological execution, Safety override, async logger.
- Genuine logic in `risk` (TTC/collision-probability fusion), `driver_twin`, `planner`, `control`.
- A REST/SSE server the cockpit can actually consume.

**NOT included (needs hardware + a backend, not a web app):**
- Rust/NATS ultra-low-latency bus, Unreal digital-twin sim, real cameras/LiDAR/CAN.
- A real <100 ms closed control loop driving an actuator. Here, "control" outputs commands
  for a *simulated* vehicle / the cockpit HUD — it does not actuate a car.
- ML perception/prediction (here: deterministic geometric models, swappable for ONNX/TensorRT).

The point of this module: the **orchestration and cognition architecture is real and runnable
today**, with clean seams where the heavy production pieces (ML models, Rust transport, sim)
plug in.

## Wiring the cockpit (optional)

```js
// in public/os.html, when running the local agent server:
const es = new EventSource('http://localhost:8787/stream');
es.onmessage = (e) => { const { ui, control, risk } = JSON.parse(e.data); /* render */ };
```
