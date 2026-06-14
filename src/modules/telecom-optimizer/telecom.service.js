/**
 * Telecom Optimizer — business logic.
 *
 * All graph algorithms (Dijkstra + A*) run in Node.js — no Python required.
 * Adjacency maps for all 5 topology templates are pre-built once at startup.
 *
 * H_SCALE = 3: every edge in every template satisfies  w >= 3 × euclidean(u,v)
 * so the A* heuristic is admissible and always returns the optimal path.
 */
const {
  TOPOLOGY_TEMPLATES, ALGORITHMS, DEFAULT_ALGORITHM, DEFAULT_TOPOLOGY,
} = require('./telecom.constants')

// Pre-build per-topology data structures once at startup (cheap — small graphs).
const TOPO_MAP = Object.fromEntries(
  TOPOLOGY_TEMPLATES.map(t => {
    const nodeById = Object.fromEntries(t.nodes.map(n => [n.id, n]))
    const adj = {}
    for (const n of t.nodes) adj[n.id] = []
    for (const [a, b, w] of t.edges) {
      adj[a].push({ to: b, w })
      adj[b].push({ to: a, w }) // undirected
    }
    return [t.id, { nodes: t.nodes, nodeById, adj }]
  })
)

const H_SCALE = 3 // admissible for all 5 templates (w >= 3*d for every edge)

function heuristic(aId, bId, nodeById) {
  const a = nodeById[aId], b = nodeById[bId]
  return Math.hypot(a.x - b.x, a.y - b.y) * H_SCALE
}

function getTopo(topologyId) {
  return TOPO_MAP[topologyId] || TOPO_MAP[DEFAULT_TOPOLOGY]
}

function getTopologies() {
  return TOPOLOGY_TEMPLATES.map(({ id, name, description, useCase, defaultSource, defaultTarget, nodes, edges }) => ({
    id, name, description, useCase, defaultSource, defaultTarget,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  }))
}

function getNodes(topologyId = DEFAULT_TOPOLOGY) {
  return getTopo(topologyId).nodes
}

function getInfo() {
  return {
    topologyCount: TOPOLOGY_TEMPLATES.length,
    algorithms: ALGORITHMS,
    defaultAlgorithm: DEFAULT_ALGORITHM,
    defaultTopology: DEFAULT_TOPOLOGY,
    topologies: TOPOLOGY_TEMPLATES.map(t => ({ id: t.id, name: t.name, nodeCount: t.nodes.length })),
  }
}

/**
 * Compute shortest path by total edge weight (latency in ms).
 * @param {string} source      - source node id
 * @param {string} target      - target node id
 * @param {string} algorithm   - 'dijkstra' | 'astar'
 * @param {string} topologyId  - which topology template to use
 * @returns {{ path, hops, totalLatency, algorithm, topologyId, nodesExplored, segments }}
 * @throws Error with .code 'BAD_NODE' | 'NO_PATH'
 */
function shortestPath({ source, target, algorithm = DEFAULT_ALGORITHM, topologyId = DEFAULT_TOPOLOGY }) {
  const { adj, nodeById } = getTopo(topologyId)
  const algo = ALGORITHMS.includes(algorithm) ? algorithm : DEFAULT_ALGORITHM

  if (!nodeById[source]) throw withCode(new Error(`Unknown source node "${source}" in topology "${topologyId}"`), 'BAD_NODE')
  if (!nodeById[target]) throw withCode(new Error(`Unknown target node "${target}" in topology "${topologyId}"`), 'BAD_NODE')

  const dist = {}, prev = {}, visited = new Set()
  for (const id of Object.keys(adj)) dist[id] = Infinity
  dist[source] = 0
  let nodesExplored = 0

  const open = new Set(Object.keys(adj))
  while (open.size) {
    let current = null, best = Infinity
    for (const id of open) {
      const f = dist[id] + (algo === 'astar' ? heuristic(id, target, nodeById) : 0)
      if (f < best) { best = f; current = id }
    }
    if (current === null || dist[current] === Infinity) break

    open.delete(current)
    visited.add(current)
    nodesExplored++
    if (current === target) break

    for (const { to, w } of adj[current]) {
      if (visited.has(to)) continue
      const alt = dist[current] + w
      if (alt < dist[to]) { dist[to] = alt; prev[to] = current }
    }
  }

  if (dist[target] === Infinity) throw withCode(new Error('No route between nodes'), 'NO_PATH')

  const path = []
  for (let at = target; at != null; at = prev[at]) path.unshift(at)

  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const edge = adj[path[i]].find(e => e.to === path[i + 1])
    segments.push({ from: path[i], to: path[i + 1], latency: edge.w })
  }

  return { path, hops: path.length - 1, totalLatency: dist[target], algorithm: algo, topologyId, nodesExplored, segments }
}

function withCode(err, code) { err.code = code; return err }

module.exports = { getNodes, getInfo, getTopologies, shortestPath }
