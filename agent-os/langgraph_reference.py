"""
langgraph_reference.py — PRACTICE OS drive graph, canonical LangGraph implementation.

This is the PRODUCTION reference that the runnable Node twin (graph.mjs) mirrors
node-for-node and edge-for-edge. It is real LangGraph code.

Run (needs Python 3.10+):
    pip install langgraph
    python agent-os/langgraph_reference.py

The node bodies here are intentionally compact; the validated numeric logic lives in
nodes.mjs (and would be shared with the Rust hot path in production via FFI / a schema).
"""
from __future__ import annotations
from typing import TypedDict, List
import math

from langgraph.graph import StateGraph, END


# ---------- GLOBAL STATE ----------
class DriveState(TypedDict, total=False):
    sensor_frame: dict
    world_model: dict
    driver_twin: dict
    risk_score: float
    intent: dict
    trajectory: dict
    control: dict
    ui: dict
    events: list
    safety_override: bool
    _raw: dict
    _t: int


P1, P0 = 0.45, 0.80
clamp = lambda x, lo, hi: max(lo, min(hi, x))


# ---------- NODES (each returns a partial state patch) ----------
def sensor_node(s: DriveState) -> DriveState:
    r = s["_raw"]
    return {"sensor_frame": {
        "t": s["_t"], "speed": r.get("speed", 0), "accel": r.get("accel", 0),
        "heading": r.get("heading", 0), "steering": r.get("steering", 0),
        "yaw_rate": r.get("yaw_rate", 0), "entities": r.get("entities", []),
        "env": {"road": r.get("road", "urban"), "weather": r.get("weather", "clear"),
                "visibility": r.get("visibility", 1)},
    }}


def perception_node(s: DriveState) -> DriveState:
    f = s["sensor_frame"]
    objects = [{"id": i, "type": e["type"], "distance": e["distance"], "rel_v": e["rel_v"],
                "lane": e.get("lane", 0), "closing": e["rel_v"] < 0}
               for i, e in enumerate(f["entities"])]
    grip = {"rain": 0.72, "snow": 0.5}.get(f["env"]["weather"], 0.95)
    return {"world_model": {"road_type": f["env"]["road"],
                            "lane": {"id": 0, "offset": f["steering"] * 0.4},
                            "objects": objects, "grip": grip,
                            "visibility": f["env"]["visibility"]}}


def prediction_node(s: DriveState) -> DriveState:
    H = 4.0
    pred = []
    for o in s["world_model"]["objects"]:
        ttc = o["distance"] / max(-o["rel_v"], 0.1) if o["closing"] else math.inf
        pred.append({"id": o["id"], "ttc": ttc,
                     "future_distance": o["distance"] + o["rel_v"] * H, "lane": o["lane"]})
    f = s["sensor_frame"]
    ego = "lane_keep"
    if abs(f["steering"]) > 0.25:
        ego = "turn_right" if f["steering"] > 0 else "turn_left"
    elif f["accel"] < -1.5:
        ego = "brake"
    return {"intent": {"ego": ego, "horizon_s": H, "predicted": pred}}


def driver_twin_node(s: DriveState) -> DriveState:
    f, prev = s["sensor_frame"], s.get("driver_twin", {})
    spd_k = f["speed"] * 3.6
    g_lon = f["accel"] / 9.81
    g_lat = abs((f["yaw_rate"] * math.pi / 180) * f["speed"]) / 9.81
    inst = 100 - min(1, abs(g_lon) / 0.5) * 55 - min(1, g_lat / 0.7) * 35
    smooth = prev.get("smooth", 82) * 0.93 + max(0, inst) * 0.07
    ia = min(100, (max(0, abs(g_lon) - 0.18) / 0.5 + max(0, g_lat - 0.3) / 0.6) * 100)
    aggression = prev.get("aggression", 12) * 0.92 + ia * 0.08
    fatigue = clamp(4 + (16 if s["_raw"].get("night") else 0), 0, 100)
    focus = max(20, 100 - aggression * 0.35 - max(0, fatigue - 40) * 0.6)
    reaction = clamp(0.7 + fatigue / 130 + aggression / 400, 0.55, 1.6)
    state = "calm"
    if g_lat > 0.55 or aggression > 55:
        state = "aggressive"
    elif fatigue > 62:
        state = "fatigued"
    elif aggression > 34 or spd_k > 110:
        state = "stressed"
    elif spd_k > 30 and smooth > 72:
        state = "focused"
    return {"driver_twin": {"smooth": smooth, "aggression": aggression, "fatigue": fatigue,
                            "focus": focus, "reaction_time": reaction, "state": state}}


def risk_engine_node(s: DriveState) -> DriveState:
    tw, grip, tau = s["driver_twin"], s["world_model"]["grip"], 2.5
    risk = 0.0
    for p in s["intent"]["predicted"]:
        if not math.isfinite(p["ttc"]):
            continue
        ttc_eff = max(0.05, p["ttc"] - tw["reaction_time"]) * grip
        p_coll = clamp(math.exp(-ttc_eff / tau), 0, 1)
        impact = clamp(1 - p["future_distance"] / 60, 0.2, 1)
        risk += p_coll * impact
    risk = clamp(risk + max(0, s["sensor_frame"]["speed"] * 3.6 - 130) / 200, 0, 1)
    return {"risk_score": risk, "safety_override": risk >= P0}


def planner_node(s: DriveState) -> DriveState:
    f, risk = s["sensor_frame"], s["risk_score"]
    if s["safety_override"]:
        target = 0.0
    elif risk > P1:
        target = f["speed"] * (1 - risk * 0.6)
    else:
        target = min(f["speed"] + 1.5, f["speed"] * 1.05 + 0.5)
    steer = clamp(-s["world_model"]["lane"]["offset"] / 0.4, -1, 1) * s["world_model"]["grip"]
    reason = "P0_emergency" if s["safety_override"] else ("risk_decel" if risk > P1 else "cruise")
    return {"trajectory": {"target_speed": target, "target_steer": steer, "reason": reason}}


def control_node(s: DriveState) -> DriveState:
    f, tr = s["sensor_frame"], s["trajectory"]
    dv, throttle, brake = tr["target_speed"] - f["speed"], 0.0, 0.0
    if s["safety_override"]:
        brake = 1.0
    elif dv > 0.1:
        throttle = clamp(dv / 4, 0, 1)
    elif dv < -0.1:
        brake = clamp(-dv / 5, 0, 1)
    steering = clamp(s.get("control", {}).get("steering", 0) * 0.5 + tr["target_steer"] * 0.5, -1, 1)
    return {"control": {"steering": round(steering, 3), "throttle": round(throttle, 3), "brake": round(brake, 3)}}


def ui_node(s: DriveState) -> DriveState:
    risk, tw = s["risk_score"], s["driver_twin"]
    level = "CRITICAL" if s["safety_override"] else ("ALERT" if risk > P1 else "SAFE")
    # priority stack: 1 Safety > 2 Navigation > 3 Optimization > 4 Commentary
    candidates = []
    if s["safety_override"]:
        candidates.append((1, "Freinage. Véhicule sur la trajectoire.", "FREINE"))
    if tw["state"] == "fatigued":
        candidates.append((2.5, "Signes de fatigue, prévois une pause.", "Fatigue"))
    candidates.append((4, None, {"calm": "Tout roule.", "focused": "Concentré.",
                                 "stressed": "Reste souple.", "aggressive": "Du calme.",
                                 "fatigued": "Repose-toi."}[tw["state"]]))
    candidates.sort(key=lambda c: c[0])
    p, voice, primary = candidates[0]
    return {"ui": {"state": level, "primary": primary, "voice": voice,
                   "hud": {"risk_field": round(risk, 2), "driver_state": tw["state"],
                           "grip": s["world_model"]["grip"]},
                   "actions": ["emergency_brake"] if s["safety_override"] else []}}


def logger_node(s: DriveState) -> DriveState:
    rec = {"t": s["_t"], "risk": round(s["risk_score"], 2), "state": s["ui"]["state"],
           "reason": s["trajectory"]["reason"]}
    return {"events": s.get("events", []) + [rec]}


# ---------- GRAPH WIRING (exactly the spec) ----------
def build_graph():
    g = StateGraph(DriveState)
    for name, fn in [("sensor", sensor_node), ("perception", perception_node),
                     ("prediction", prediction_node), ("driver_twin", driver_twin_node),
                     ("risk", risk_engine_node), ("planner", planner_node),
                     ("control", control_node), ("ui", ui_node), ("logger", logger_node)]:
        g.add_node(name, fn)
    g.set_entry_point("sensor")
    g.add_edge("sensor", "perception")
    g.add_edge("sensor", "driver_twin")     # human model runs in parallel off the raw frame
    g.add_edge("perception", "prediction")
    g.add_edge("prediction", "risk")        # risk fuses prediction ...
    g.add_edge("driver_twin", "risk")       # ... and the driver twin
    g.add_edge("risk", "planner")
    g.add_edge("planner", "control")
    g.add_edge("control", "ui")             # UI reads the merged perception layer
    g.add_edge("ui", "logger")
    g.add_edge("logger", END)
    return g.compile()


if __name__ == "__main__":
    app = build_graph()
    cut_in = {"_t": 3000, "_raw": {"speed": 14, "accel": 0, "heading": 92, "steering": 0,
                                   "yaw_rate": 4, "entities": [{"type": "vehicle", "distance": 8, "rel_v": -9, "lane": 0}]},
              "driver_twin": {}, "events": []}
    out = app.invoke(cut_in)
    print("LEVEL    :", out["ui"]["state"])
    print("RISK     :", round(out["risk_score"], 2))
    print("CONTROL  :", out["control"])
    print("VOICE    :", out["ui"]["voice"])
    print("TRACE    :", out["events"])
