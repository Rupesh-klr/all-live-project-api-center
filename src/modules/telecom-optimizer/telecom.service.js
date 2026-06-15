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

// Ring buffer for the History tab — last 20 paths computed this session.
const pathHistory = []

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

  const result = { path, hops: path.length - 1, totalLatency: dist[target], algorithm: algo, topologyId, nodesExplored, segments }

  // Record in history ring buffer (newest first on retrieval)
  pathHistory.push({ source, target, algorithm: algo, topologyId, totalLatency: dist[target], hops: path.length - 1, nodesExplored, ts: Date.now() })
  if (pathHistory.length > 20) pathHistory.shift()

  return result
}

// ── Path History ──────────────────────────────────────────────────────────────

function getHistory() {
  return [...pathHistory].reverse()
}

// ── Yen's K-Shortest Loopless Paths ───────────────────────────────────────────
// Finds the K best *distinct* routes between two nodes (not just the single
// shortest). Each spur is solved with Dijkstra over the graph minus the edges
// and nodes that would recreate an already-found path. This is what carriers use
// to pre-provision backup routes for failover.

const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)

function getWeight(topo, a, b) {
  const e = topo.adj[a]?.find(x => x.to === b)
  return e ? e.w : Infinity
}

function sumPath(topo, path) {
  let s = 0
  for (let i = 0; i < path.length - 1; i++) s += getWeight(topo, path[i], path[i + 1])
  return s
}

function buildSegments(topo, path) {
  const segs = []
  for (let i = 0; i < path.length - 1; i++) segs.push({ from: path[i], to: path[i + 1], latency: getWeight(topo, path[i], path[i + 1]) })
  return segs
}

// Dijkstra that honours removed edges (by undirected key) and removed nodes.
function dijkstraWithRemovals(topo, source, target, removedEdges, removedNodes) {
  const { adj } = topo
  const ids = Object.keys(adj)
  const dist = {}, prev = {}
  for (const id of ids) dist[id] = Infinity
  dist[source] = 0

  const visited = new Set()
  const open = new Set(ids.filter(n => !removedNodes.has(n)))
  open.add(source); open.add(target)

  while (open.size) {
    let cur = null, best = Infinity
    for (const id of open) if (dist[id] < best) { best = dist[id]; cur = id }
    if (cur === null || dist[cur] === Infinity) break
    open.delete(cur); visited.add(cur)
    if (cur === target) break

    for (const { to, w } of adj[cur]) {
      if (visited.has(to)) continue
      if (removedNodes.has(to) && to !== target) continue
      if (removedEdges.has(edgeKey(cur, to))) continue
      const alt = dist[cur] + w
      if (alt < dist[to]) { dist[to] = alt; prev[to] = cur }
    }
  }

  if (dist[target] === Infinity) return null
  const path = []
  for (let at = target; at != null; at = prev[at]) path.unshift(at)
  return { path, cost: dist[target] }
}

function kShortestPaths({ source, target, topologyId = DEFAULT_TOPOLOGY, K = 3 }) {
  const topo = getTopo(topologyId)
  const { nodeById } = topo
  if (!nodeById[source]) throw withCode(new Error(`Unknown source node "${source}" in topology "${topologyId}"`), 'BAD_NODE')
  if (!nodeById[target]) throw withCode(new Error(`Unknown target node "${target}" in topology "${topologyId}"`), 'BAD_NODE')
  K = Math.min(Math.max(parseInt(K, 10) || 3, 1), 8)

  const first = dijkstraWithRemovals(topo, source, target, new Set(), new Set())
  if (!first) throw withCode(new Error('No route between nodes'), 'NO_PATH')

  const A = [first]   // confirmed shortest paths (ascending cost)
  const B = []        // candidate paths

  const seen = new Set([first.path.join('>')])

  while (A.length < K) {
    const prevPath = A[A.length - 1].path

    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i]
      const rootPath = prevPath.slice(0, i + 1)

      const removedEdges = new Set()
      const removedNodes = new Set()

      for (const p of A) {
        if (p.path.length > i && p.path.slice(0, i + 1).join('>') === rootPath.join('>')) {
          removedEdges.add(edgeKey(p.path[i], p.path[i + 1]))
        }
      }
      for (const n of rootPath.slice(0, -1)) removedNodes.add(n)

      const spur = dijkstraWithRemovals(topo, spurNode, target, removedEdges, removedNodes)
      if (!spur) continue

      const totalPath = rootPath.slice(0, -1).concat(spur.path)
      const key = totalPath.join('>')
      if (seen.has(key) || B.some(b => b.path.join('>') === key)) continue

      B.push({ path: totalPath, cost: sumPath(topo, totalPath) })
    }

    if (!B.length) break
    B.sort((a, b) => a.cost - b.cost)
    const next = B.shift()
    seen.add(next.path.join('>'))
    A.push(next)
  }

  const best = A[0].cost
  return {
    source, target, topologyId,
    count: A.length,
    paths: A.map((p, i) => ({
      rank: i + 1,
      path: p.path,
      totalLatency: p.cost,
      hops: p.path.length - 1,
      extraLatency: p.cost - best, // ms slower than the optimal route
      segments: buildSegments(topo, p.path),
    })),
  }
}

// ── Algorithm Benchmark ───────────────────────────────────────────────────────

function benchmark({ source, target, topologyId = DEFAULT_TOPOLOGY }) {
  const { nodeById } = getTopo(topologyId)
  if (!nodeById[source]) throw withCode(new Error(`Unknown source node "${source}" in topology "${topologyId}"`), 'BAD_NODE')
  if (!nodeById[target]) throw withCode(new Error(`Unknown target node "${target}" in topology "${topologyId}"`), 'BAD_NODE')

  const d = shortestPath({ source, target, algorithm: 'dijkstra', topologyId })
  const a = shortestPath({ source, target, algorithm: 'astar',    topologyId })

  const savingPct = d.nodesExplored > 0
    ? Math.round((d.nodesExplored - a.nodesExplored) / d.nodesExplored * 100)
    : 0

  return {
    topologyId, source, target,
    dijkstra: { path: d.path, totalLatency: d.totalLatency, hops: d.hops, nodesExplored: d.nodesExplored },
    astar:    { path: a.path, totalLatency: a.totalLatency, hops: a.hops, nodesExplored: a.nodesExplored },
    winner: a.nodesExplored <= d.nodesExplored ? 'astar' : 'dijkstra',
    explorationSavingPct: savingPct,
    sameOptimal: d.totalLatency === a.totalLatency,
  }
}

function withCode(err, code) { err.code = code; return err }

module.exports = { getNodes, getInfo, getTopologies, shortestPath, getHistory, benchmark, kShortestPaths }
