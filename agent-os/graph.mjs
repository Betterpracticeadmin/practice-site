// graph.mjs — a minimal stateful graph engine with LangGraph-like semantics.
//
// Nodes return PARTIAL patches that are merged into the global DriveState.
// Main edges define data dependencies (executed in topological order so a node
// runs only once all its predecessors have). Side edges fan out to the UI node
// (non-blocking read-only). Async nodes (logger) run fire-and-forget.
//
// This is the SAME topology as langgraph_reference.py — it is the runnable twin.

import { performance } from 'node:perf_hooks';
import {
  sensorNode, perceptionNode, predictionNode, driverTwinNode,
  riskEngineNode, plannerNode, controlNode, uiNode, loggerNode,
} from './nodes.mjs';

export class StateGraph {
  constructor() {
    this.nodes = {};        // name -> fn
    this.preds = {};        // name -> [predecessor names]  (main edges)
    this.sideTargets = [];  // [{from, to}] non-blocking
    this.asyncNodes = [];   // run after main chain, non-blocking
    this.entry = null;
  }
  addNode(name, fn) { this.nodes[name] = fn; this.preds[name] ??= []; return this; }
  addEdge(from, to) { this.preds[to] ??= []; this.preds[to].push(from); return this; }
  addSideEdge(from, to) { this.sideTargets.push({ from, to }); return this; }
  addAsyncNode(name, fn) { this.nodes[name] = fn; this.asyncNodes.push(name); return this; }
  setEntry(name) { this.entry = name; return this; }

  // Kahn topological sort over the main-edge DAG (excludes side/async nodes).
  _topo() {
    const main = Object.keys(this.nodes).filter((n) => !this.asyncNodes.includes(n) && !this.sideTargets.some((e) => e.to === n));
    const indeg = {}, adj = {};
    main.forEach((n) => { indeg[n] = 0; adj[n] = []; });
    main.forEach((n) => (this.preds[n] || []).forEach((p) => { if (main.includes(p)) { adj[p].push(n); indeg[n]++; } }));
    const q = main.filter((n) => indeg[n] === 0), order = [];
    while (q.length) {
      const n = q.shift(); order.push(n);
      adj[n].forEach((m) => { if (--indeg[m] === 0) q.push(m); });
    }
    if (order.length !== main.length) throw new Error('cycle in graph');
    return order;
  }

  async invoke(state) {
    const order = this._topo();
    const timings = {};
    const merge = (patch) => { if (patch) Object.assign(state, patch); };

    for (const name of order) {
      const t0 = performance.now();
      merge(await this.nodes[name](state));
      timings[name] = +(performance.now() - t0).toFixed(3);
    }
    // side edges → UI (run UI once, after its sources are ready)
    const uiTargets = [...new Set(this.sideTargets.map((e) => e.to))];
    for (const ui of uiTargets) {
      const t0 = performance.now();
      merge(await this.nodes[ui](state));
      timings[ui] = +(performance.now() - t0).toFixed(3);
    }
    // async non-blocking nodes (logger) — awaited here only so the demo can read the trace
    for (const name of this.asyncNodes) {
      const t0 = performance.now();
      merge(await this.nodes[name](state));
      timings[name] = +(performance.now() - t0).toFixed(3);
    }
    state._timings = timings;
    return state;
  }
}

// Build the PRACTICE OS drive graph exactly as specified.
export function buildDriveGraph() {
  const g = new StateGraph();
  g.addNode('sensor', sensorNode)
    .addNode('perception', perceptionNode)
    .addNode('prediction', predictionNode)
    .addNode('driver_twin', driverTwinNode)
    .addNode('risk', riskEngineNode)
    .addNode('planner', plannerNode)
    .addNode('control', controlNode)
    .addNode('ui', uiNode)
    .addAsyncNode('logger', loggerNode);

  g.setEntry('sensor');
  // main edges (data dependencies)
  g.addEdge('sensor', 'perception');
  g.addEdge('sensor', 'driver_twin');     // twin reads the raw frame, runs in parallel
  g.addEdge('perception', 'prediction');
  g.addEdge('prediction', 'risk');        // risk fuses prediction ...
  g.addEdge('driver_twin', 'risk');       // ... and the human model
  g.addEdge('risk', 'planner');
  g.addEdge('planner', 'control');
  // side edges → UI (non-blocking perception layer)
  g.addSideEdge('perception', 'ui');
  g.addSideEdge('risk', 'ui');
  g.addSideEdge('planner', 'ui');
  g.addSideEdge('driver_twin', 'ui');
  return g;
}
