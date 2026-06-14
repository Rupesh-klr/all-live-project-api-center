/**
 * Telecom Optimizer — business logic.
 *
 * Pure functions over the demo graph: node listing and an actual shortest-path
 * computation (Dijkstra and A*). No Express here — controllers in app.js call these.
 */
const {
  DEMO_NODES, DEMO_EDGES, ALGORITHMS, DEFAULT_ALGORITHM,
} = require('./telecom.constants')

// Build an adjacency map once: { N1: [{ to:'N2', w:12 }, ...], ... }
const ADJ = (() => {
  const m = {}
  for (const n of DEMO_NODES) m[n.id] = []
  for (const [a, b, w] of DEMO_EDGES) {
    m[a].push({ to: b, w })
    m[b].push({ to: a, w }) // undirected
  }
  return m
})()

const NODE_BY_ID = Object.fromEntries(DEMO_NODES.map(n => [n.id, n]))

function getNodes() {
  return DEMO_NODES
}

function getInfo() {
  return {
    nodeCount: DEMO_NODES.length,
    edgeCount: DEMO_EDGES.length,
    algorithms: ALGORITHMS,
    defaultAlgorithm: DEFAULT_ALGORITHM,
  }
}

// Straight-line distance heuristic for A*. Scaled by H_SCALE to be comparable to edge
// latencies (≈ ms per coordinate unit) so the heuristic actually guides the search.
// H_SCALE (4) stays <= the lowest real latency-per-distance ratio in the demo graph,
// which keeps the heuristic admissible (never overestimates true cost).
const H_SCALE = 4
function heuristic(aId, bId) {
  const a = NODE_BY_ID[aId], b = NODE_BY_ID[bId]
  return Math.hypot(a.x - b.x, a.y - b.y) * H_SCALE
}

/**
 * Compute the shortest path by total latency.
 * @returns { path, hops, totalLatency, algorithm, nodesExplored, segments }
 * @throws  Error with .code 'BAD_NODE' | 'NO_PATH'
 */
function shortestPath({ source, target, algorithm = DEFAULT_ALGORITHM }) {
  const algo = ALGORITHMS.includes(algorithm) ? algorithm : DEFAULT_ALGORITHM

  if (!NODE_BY_ID[source]) throw withCode(new Error(`Unknown source node "${source}"`), 'BAD_NODE')
  if (!NODE_BY_ID[target]) throw withCode(new Error(`Unknown target node "${target}"`), 'BAD_NODE')

  const dist = {}, prev = {}, visited = new Set()
  for (const id of Object.keys(ADJ)) dist[id] = Infinity
  dist[source] = 0
  let nodesExplored = 0

  // Simple priority selection (fine for this graph size). f = g (+ h for A*).
  const open = new Set(Object.keys(ADJ))
  while (open.size) {
    let current = null, best = Infinity
    for (const id of open) {
      const f = dist[id] + (algo === 'astar' ? heuristic(id, target) : 0)
      if (f < best) { best = f; current = id }
    }
    if (current === null || dist[current] === Infinity) break

    open.delete(current)
    visited.add(current)
    nodesExplored++
    if (current === target) break

    for (const { to, w } of ADJ[current]) {
      if (visited.has(to)) continue
      const alt = dist[current] + w
      if (alt < dist[to]) { dist[to] = alt; prev[to] = current }
    }
  }

  if (dist[target] === Infinity) throw withCode(new Error('No route between nodes'), 'NO_PATH')

  // Reconstruct path
  const path = []
  for (let at = target; at != null; at = prev[at]) path.unshift(at)

  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const edge = ADJ[path[i]].find(e => e.to === path[i + 1])
    segments.push({ from: path[i], to: path[i + 1], latency: edge.w })
  }

  return {
    path,
    hops: path.length - 1,
    totalLatency: dist[target],
    algorithm: algo,
    nodesExplored,
    segments,
  }
}

function withCode(err, code) { err.code = code; return err }

module.exports = { getNodes, getInfo, shortestPath }
