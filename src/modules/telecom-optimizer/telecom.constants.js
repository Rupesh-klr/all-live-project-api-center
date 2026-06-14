/**
 * Telecom Optimizer — module-owned constants & demo dataset.
 *
 * Everything specific to this module lives here (data), the algorithms live in
 * telecom.service.js (logic), and the routing lives in app.js (transport). Clone
 * this 3-file shape for any new module.
 *
 * The demo network is a small weighted graph (latency in ms) with coordinates so
 * A* has a real admissible heuristic — the shortest-path endpoint genuinely computes.
 */

// Node coordinates feed the A* heuristic; latency/status feed the health table.
const DEMO_NODES = [
  { id: 'N1',  name: 'Node Alpha',   region: 'us-east',  x: 0, y: 0, latency: 12, status: 'active'   },
  { id: 'N2',  name: 'Node Beta',    region: 'us-east',  x: 2, y: 1, latency: 8,  status: 'active'   },
  { id: 'N3',  name: 'Node Gamma',   region: 'us-west',  x: 4, y: 0, latency: 24, status: 'degraded' },
  { id: 'N4',  name: 'Node Delta',   region: 'eu-west',  x: 1, y: 3, latency: 5,  status: 'active'   },
  { id: 'N5',  name: 'Node Epsilon', region: 'eu-west',  x: 3, y: 3, latency: 11, status: 'active'   },
  { id: 'N6',  name: 'Node Zeta',    region: 'us-west',  x: 5, y: 2, latency: 9,  status: 'active'   },
  { id: 'N7',  name: 'Node Eta',     region: 'ap-south', x: 6, y: 4, latency: 7,  status: 'active'   },
  { id: 'N8',  name: 'Node Theta',   region: 'eu-north', x: 2, y: 5, latency: 16, status: 'active'   },
  { id: 'N9',  name: 'Node Iota',    region: 'ap-south', x: 4, y: 5, latency: 21, status: 'degraded' },
  { id: 'N10', name: 'Node Kappa',   region: 'ap-east',  x: 6, y: 6, latency: 9,  status: 'active'   },
  { id: 'N11', name: 'Node Lambda',  region: 'eu-north', x: 0, y: 5, latency: 14, status: 'active'   },
  { id: 'N12', name: 'Node Mu',      region: 'ap-east',  x: 5, y: 7, latency: 6,  status: 'active'   },
]

// Undirected weighted edges — weight is link latency in ms.
const DEMO_EDGES = [
  ['N1', 'N2', 12], ['N1', 'N4', 18],
  ['N2', 'N3', 10], ['N2', 'N5', 14],
  ['N3', 'N6', 9],
  ['N4', 'N5', 8],  ['N4', 'N8', 16],
  ['N5', 'N6', 11], ['N5', 'N9', 13],
  ['N6', 'N7', 7],
  ['N7', 'N10', 9],
  ['N8', 'N9', 10], ['N8', 'N11', 12],
  ['N9', 'N10', 8], ['N9', 'N12', 15],
  ['N10', 'N12', 6],
]

const ALGORITHMS = ['dijkstra', 'astar']
const DEFAULT_ALGORITHM = 'dijkstra'

// Optional external Python (FastAPI + NetworkX) compute service. When unset, the
// Node service computes locally so demos never break.
const PYTHON_SERVICE_URL = process.env.TELECOM_PYTHON_URL || ''

// Endpoints intentionally exposed without auth (recruiter can hit them directly).
const PUBLIC_ENDPOINTS = ['/info', '/health', '/demo/nodes']

module.exports = {
  DEMO_NODES,
  DEMO_EDGES,
  ALGORITHMS,
  DEFAULT_ALGORITHM,
  PYTHON_SERVICE_URL,
  PUBLIC_ENDPOINTS,
}
