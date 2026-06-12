// server.mjs — streams the drive graph output over Server-Sent Events (stdlib only, no deps).
// Run:  node agent-os/server.mjs   →  http://localhost:8787/stream
//
// This is the bridge: the cockpit (public/os.html) can `new EventSource('http://localhost:8787/stream')`
// and render real risk/control/voice produced by the 9-node graph each tick.

import http from 'node:http';
import { buildDriveGraph } from './graph.mjs';
import { newDriveState } from './drive_state.mjs';

const g = buildDriveGraph();
const PORT = 8787;

// a looping synthetic drive (replace with live GPS frames posted from the cockpit)
const script = [
  { speed: 11, accel: 1.0, heading: 90, steering: 0.05, entities: [{ type: 'vehicle', distance: 40, rel_v: -2, lane: 0 }] },
  { speed: 13, accel: 0.4, heading: 92, steering: 0.10, entities: [{ type: 'vehicle', distance: 30, rel_v: -3, lane: 0 }] },
  { speed: 14, accel: 0.0, heading: 92, steering: 0.0, yaw_rate: 4, entities: [{ type: 'vehicle', distance: 8, rel_v: -9, lane: 0 }] }, // cut-in → CRITICAL
  { speed: 9, accel: -2, heading: 92, steering: -0.05, entities: [{ type: 'vehicle', distance: 26, rel_v: -1, lane: 0 }] },
  { speed: 22, accel: 0.6, heading: 95, steering: 0.0, road: 'highway', entities: [] },
];

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    return res.end(JSON.stringify({ ok: true, nodes: 9 }));
  }

  // POST /tick { ...frame } → run one cycle, return merged ui/control
  if (req.method === 'POST' && req.url === '/tick') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let frame = {}; try { frame = JSON.parse(body || '{}'); } catch {}
      const out = await g.invoke(newDriveState({ ...frame, t: frame.t || 0 }));
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ ui: out.ui, control: out.control, risk: out.risk_score, twin: out.driver_twin }));
    });
    return;
  }

  if (req.url === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...cors });
    let i = 0, twin, t = 0;
    const tick = async () => {
      const st = newDriveState({ ...script[i % script.length], t });
      if (twin) st.driver_twin = twin;
      const out = await g.invoke(st);
      twin = out.driver_twin; t += 700; i++;
      res.write(`data: ${JSON.stringify({ ui: out.ui, control: out.control, risk: +out.risk_score.toFixed(2), twin: out.driver_twin.state })}\n\n`);
    };
    const iv = setInterval(tick, 700);
    req.on('close', () => clearInterval(iv));
    return;
  }

  res.writeHead(404, cors); res.end('not found');
});

server.listen(PORT, () => console.log(`PRACTICE OS agent graph → http://localhost:${PORT}/stream  (SSE)  ·  POST /tick  ·  /health`));
