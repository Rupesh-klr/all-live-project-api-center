/**
 * Telecom Optimizer — module-owned constants & 5 topology templates.
 *
 * ── NO PYTHON REQUIRED ─────────────────────────────────────────────────────────
 * Dijkstra and A* run entirely in Node.js (telecom.service.js). The optional
 * TELECOM_PYTHON_URL env var bridges to a heavy-compute FastAPI service when set,
 * but ALL demos work 100% offline without it — just leave it blank.
 *
 * ── A* ADMISSIBILITY GUARANTEE ─────────────────────────────────────────────────
 * H_SCALE = 3. Every edge in every template satisfies  w ≥ 3 × euclidean(u, v)
 * so the heuristic h(n) = H_SCALE × euclidean(n, goal) never overestimates the
 * true cost. A* is therefore guaranteed to find the optimal path.
 *
 * ── 5 TOPOLOGY TEMPLATES ───────────────────────────────────────────────────────
 * All graph data lives here as plain constants — no DB, no file reads.
 * backbone      — Mixed multi-region WAN (12 nodes) — the default
 * metro-ring    — City fiber ring with bypass shortcuts (8 nodes)
 * hub-spoke     — ISP PoP hub-and-spoke (9 nodes)
 * linear-chain  — Submarine cable trunk + branch spur (8 nodes)
 * cdn-mesh      — Global CDN partial mesh (10 nodes)
 */

// ── Topology 1: Multi-Region Backbone ─────────────────────────────────────────
const BACKBONE_NODES = [
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
const BACKBONE_EDGES = [
  ['N1', 'N2', 12], ['N1', 'N4', 18],
  ['N2', 'N3', 10], ['N2', 'N5', 14],
  ['N3', 'N6',  9],
  ['N4', 'N5',  8], ['N4', 'N8', 16],
  ['N5', 'N6', 11], ['N5', 'N9', 13],
  ['N6', 'N7',  7],
  ['N7', 'N10', 9],
  ['N8', 'N9', 10], ['N8', 'N11', 12],
  ['N9', 'N10', 8], ['N9', 'N12', 15],
  ['N10','N12', 6],
]

// ── Topology 2: City Metro Ring ────────────────────────────────────────────────
// 8 PoPs in a ring around a city with cross-city bypass shortcuts.
// Ring edges d≈3.16 → w≥10. Cross-city diagonals d=8-8.5 → w≥25.
const METRO_RING_NODES = [
  { id: 'MR1', name: 'Downtown Core',     region: 'city-center', x: 4, y: 0, latency:  5, status: 'active'   },
  { id: 'MR2', name: 'East Exchange',     region: 'east',        x: 7, y: 1, latency:  8, status: 'active'   },
  { id: 'MR3', name: 'Northeast Hub',     region: 'northeast',   x: 8, y: 4, latency: 11, status: 'active'   },
  { id: 'MR4', name: 'Industrial Zone',   region: 'southeast',   x: 7, y: 7, latency:  7, status: 'active'   },
  { id: 'MR5', name: 'South Campus',      region: 'south',       x: 4, y: 8, latency:  9, status: 'active'   },
  { id: 'MR6', name: 'West Residential',  region: 'west',        x: 1, y: 7, latency: 18, status: 'degraded' },
  { id: 'MR7', name: 'Airport PoP',       region: 'northwest',   x: 0, y: 4, latency:  6, status: 'active'   },
  { id: 'MR8', name: 'University Node',   region: 'north',       x: 1, y: 1, latency: 12, status: 'active'   },
]
const METRO_RING_EDGES = [
  // Ring (clockwise)
  ['MR1','MR2', 10], ['MR2','MR3', 10], ['MR3','MR4', 11], ['MR4','MR5', 10],
  ['MR5','MR6', 11], ['MR6','MR7', 10], ['MR7','MR8', 10], ['MR8','MR1', 10],
  // Cross-city bypass links (longer cable, naturally higher latency)
  ['MR1','MR5', 25], ['MR3','MR7', 25], ['MR2','MR6', 26],
]

// ── Topology 3: Hub & Spoke ISP PoP ───────────────────────────────────────────
// 1 core hub, 4 regional PoPs, 4 edge aggregation nodes + emergency cross-links.
// All PoP edges d=4 → w≥12. Cross-region diagonals d=8 → w≥24.
const HUB_SPOKE_NODES = [
  { id: 'H1',  name: 'Core Backbone Hub', region: 'core',      x: 4, y: 4, latency:  3, status: 'active'   },
  { id: 'SP1', name: 'North PoP',         region: 'north',     x: 4, y: 0, latency:  7, status: 'active'   },
  { id: 'SP2', name: 'East PoP',          region: 'east',      x: 8, y: 4, latency:  8, status: 'active'   },
  { id: 'SP3', name: 'South PoP',         region: 'south',     x: 4, y: 8, latency:  6, status: 'active'   },
  { id: 'SP4', name: 'West PoP',          region: 'west',      x: 0, y: 4, latency:  7, status: 'active'   },
  { id: 'E1',  name: 'NE Edge Node',      region: 'northeast', x: 8, y: 0, latency: 14, status: 'active'   },
  { id: 'E2',  name: 'SE Edge Node',      region: 'southeast', x: 8, y: 8, latency: 12, status: 'degraded' },
  { id: 'E3',  name: 'SW Edge Node',      region: 'southwest', x: 0, y: 8, latency: 19, status: 'active'   },
  { id: 'E4',  name: 'NW Edge Node',      region: 'northwest', x: 0, y: 0, latency: 11, status: 'active'   },
]
const HUB_SPOKE_EDGES = [
  // Hub → PoPs
  ['H1','SP1', 13], ['H1','SP2', 14], ['H1','SP3', 13], ['H1','SP4', 14],
  // PoPs → Edge nodes
  ['SP1','E1', 13], ['SP1','E4', 14],
  ['SP2','E1', 13], ['SP2','E2', 14],
  ['SP3','E2', 13], ['SP3','E3', 14],
  ['SP4','E3', 13], ['SP4','E4', 14],
  // Emergency cross-region bypass
  ['E1','E2', 25], ['E3','E4', 25],
]

// ── Topology 4: Submarine Cable Route ─────────────────────────────────────────
// Trans-oceanic main trunk (LC1→LC5) + one branch spur to a regional landing.
// All edges d=2 → w≥6. Branch amplifier LC7 is degraded (real-world scenario).
const LINEAR_CHAIN_NODES = [
  { id: 'LC1', name: 'West Landing Station', region: 'na-west',  x: 0, y: 4, latency:  4, status: 'active'   },
  { id: 'LC2', name: 'Amplifier Station A',  region: 'mid-pac',  x: 2, y: 4, latency:  8, status: 'active'   },
  { id: 'LC3', name: 'Mid-Ocean Junction',   region: 'mid-pac',  x: 4, y: 4, latency:  7, status: 'active'   },
  { id: 'LC4', name: 'Amplifier Station B',  region: 'mid-pac',  x: 6, y: 4, latency:  8, status: 'active'   },
  { id: 'LC5', name: 'East Landing Station', region: 'ap-east',  x: 8, y: 4, latency:  4, status: 'active'   },
  { id: 'LC6', name: 'Branch Entry Point',   region: 'mid-pac',  x: 2, y: 6, latency: 11, status: 'active'   },
  { id: 'LC7', name: 'Branch Amplifier',     region: 'mid-pac',  x: 4, y: 6, latency: 16, status: 'degraded' },
  { id: 'LC8', name: 'Branch Landing',       region: 'ap-south', x: 6, y: 6, latency:  9, status: 'active'   },
]
const LINEAR_CHAIN_EDGES = [
  // Main trunk
  ['LC1','LC2',  8], ['LC2','LC3', 10], ['LC3','LC4',  9], ['LC4','LC5',  8],
  // Branch spur (higher latency via degraded LC7)
  ['LC2','LC6', 10], ['LC6','LC7', 12], ['LC7','LC8',  9], ['LC8','LC4', 10],
]

// ── Topology 5: Global CDN Mesh ────────────────────────────────────────────────
// 10 globally distributed PoPs with realistic intercontinental peering links.
// Partial mesh — not all PoPs are directly connected (real CDN constraint).
const CDN_MESH_NODES = [
  { id: 'G1',  name: 'NA-East (New York)',      region: 'na-east',    x: 0, y: 4, latency:  4, status: 'active' },
  { id: 'G2',  name: 'NA-West (Los Angeles)',   region: 'na-west',    x: 1, y: 6, latency:  5, status: 'active' },
  { id: 'G3',  name: 'SA (São Paulo)',           region: 'south-am',   x: 1, y: 8, latency: 13, status: 'active' },
  { id: 'G4',  name: 'EU-West (London)',         region: 'eu-west',    x: 4, y: 2, latency:  6, status: 'active' },
  { id: 'G5',  name: 'EU-Central (Frankfurt)',   region: 'eu-central', x: 5, y: 2, latency:  5, status: 'active' },
  { id: 'G6',  name: 'ME (Dubai)',               region: 'me',          x: 6, y: 3, latency:  9, status: 'active' },
  { id: 'G7',  name: 'AP-IN (Mumbai)',           region: 'ap-south',   x: 7, y: 4, latency: 10, status: 'active' },
  { id: 'G8',  name: 'AP-SG (Singapore)',        region: 'ap-sea',     x: 8, y: 6, latency:  8, status: 'active' },
  { id: 'G9',  name: 'AP-JP (Tokyo)',            region: 'ap-east',    x: 8, y: 2, latency:  7, status: 'active' },
  { id: 'G10', name: 'AP-AU (Sydney)',           region: 'au',          x: 8, y: 8, latency: 11, status: 'active' },
]
const CDN_MESH_EDGES = [
  // Trans-Atlantic
  ['G1','G4', 14], ['G1','G2', 10],
  // Trans-Pacific
  ['G2','G8', 25], ['G2','G3',  9],
  // SA to EU
  ['G3','G4', 22],
  // EU peering
  ['G4','G5',  7], ['G4','G6', 15],
  ['G5','G6', 14], ['G5','G9', 22],
  // ME to Asia
  ['G6','G7', 11], ['G6','G9', 18],
  // Asia peering
  ['G7','G8', 12], ['G7','G9', 14],
  ['G8','G9', 15], ['G8','G10', 10],
  ['G9','G10', 20],
]

// ── Topology registry ──────────────────────────────────────────────────────────
const TOPOLOGY_TEMPLATES = [
  {
    id: 'backbone',
    name: 'Multi-Region Backbone',
    description: '12-node mixed-hop network spanning 4 global regions. The default reference topology.',
    useCase: 'Carrier backbone routing · Multi-region WAN',
    defaultSource: 'N4',
    defaultTarget: 'N10',
    nodes: BACKBONE_NODES,
    edges: BACKBONE_EDGES,
  },
  {
    id: 'metro-ring',
    name: 'City Metro Ring',
    description: '8 PoPs arranged in a city fiber ring with cross-city bypass shortcut links.',
    useCase: 'Municipal ISP fiber ring · Smart-city backhaul',
    defaultSource: 'MR1',
    defaultTarget: 'MR5',
    nodes: METRO_RING_NODES,
    edges: METRO_RING_EDGES,
  },
  {
    id: 'hub-spoke',
    name: 'Hub & Spoke ISP',
    description: 'Central backbone hub with 4 regional PoPs and 4 edge aggregation nodes.',
    useCase: 'National ISP PoP architecture · Corporate WAN',
    defaultSource: 'E4',
    defaultTarget: 'E2',
    nodes: HUB_SPOKE_NODES,
    edges: HUB_SPOKE_EDGES,
  },
  {
    id: 'linear-chain',
    name: 'Submarine Cable',
    description: 'Trans-oceanic main trunk with a regional branch spur and amplifier stations.',
    useCase: 'International connectivity · Cable capacity planning',
    defaultSource: 'LC1',
    defaultTarget: 'LC5',
    nodes: LINEAR_CHAIN_NODES,
    edges: LINEAR_CHAIN_EDGES,
  },
  {
    id: 'cdn-mesh',
    name: 'Global CDN Mesh',
    description: '10 globally distributed PoPs with realistic intercontinental peering links.',
    useCase: 'CDN route optimisation · Latency-sensitive streaming',
    defaultSource: 'G1',
    defaultTarget: 'G10',
    nodes: CDN_MESH_NODES,
    edges: CDN_MESH_EDGES,
  },
]

// Backward-compat aliases (used by existing service code)
const DEMO_NODES = BACKBONE_NODES
const DEMO_EDGES = BACKBONE_EDGES

const ALGORITHMS    = ['dijkstra', 'astar']
const DEFAULT_ALGORITHM = 'dijkstra'
const DEFAULT_TOPOLOGY  = 'backbone'

// Optional: bridge to a Python FastAPI + NetworkX service for heavy-compute ops.
// Leave blank (or omit entirely) to use the built-in Node.js algorithms.
const PYTHON_SERVICE_URL = process.env.TELECOM_PYTHON_URL || ''

const PUBLIC_ENDPOINTS = ['/info', '/health', '/topologies', '/demo/nodes']

module.exports = {
  DEMO_NODES,
  DEMO_EDGES,
  TOPOLOGY_TEMPLATES,
  ALGORITHMS,
  DEFAULT_ALGORITHM,
  DEFAULT_TOPOLOGY,
  PYTHON_SERVICE_URL,
  PUBLIC_ENDPOINTS,
}
