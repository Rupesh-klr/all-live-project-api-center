const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok, paginated, badRequest, notFound } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./telecom.service')
const { ALGORITHMS, DEFAULT_ALGORITHM, DEFAULT_TOPOLOGY, PUBLIC_ENDPOINTS, TOPOLOGY_TEMPLATES } = require('./telecom.constants')

const router = Router()
const TOPOLOGY_IDS = TOPOLOGY_TEMPLATES.map(t => t.id)
const validTopo = (id) => TOPOLOGY_IDS.includes(id) ? id : DEFAULT_TOPOLOGY

// ── PUBLIC (no auth — safe to share with a recruiter) ─────────────────────────

router.get('/info', (req, res) =>
  ok(res, { ...meta, graph: service.getInfo() }, 'Telecom Optimizer info')
)

router.get('/health', (req, res) =>
  ok(res, { status: 'ok', ts: Date.now() }, 'Healthy')
)

// List all 5 topology templates (public — recruiter-friendly)
router.get('/topologies', (req, res) =>
  ok(res, service.getTopologies(), '5 built-in topology templates — no Python required')
)

// Paginated demo nodes for any topology (public)
router.get('/demo/nodes', (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const topologyId = validTopo(req.query.topology)
  const all = service.getNodes(topologyId)
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), `Demo nodes (${topologyId})`)
})

// ── PROTECTED (Bearer token required) ─────────────────────────────────────────

// Paginated nodes (auth) — same topology param as demo/nodes
router.get('/nodes', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const topologyId = validTopo(req.query.topology)
  const all = service.getNodes(topologyId)
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), `Network nodes (${topologyId})`)
})

// Run Dijkstra / A* shortest-path on any topology
// Body: { source, target, algorithm?, topologyId? }
router.post('/graph/shortest-path', authMiddleware, (req, res) => {
  const { source, target, algorithm = DEFAULT_ALGORITHM, topologyId = DEFAULT_TOPOLOGY } = req.body || {}

  if (!source || !target) return badRequest(res, 'source and target node IDs are required')
  if (!ALGORITHMS.includes(algorithm)) return badRequest(res, `algorithm must be one of: ${ALGORITHMS.join(', ')}`)
  if (!TOPOLOGY_IDS.includes(topologyId)) return badRequest(res, `topologyId must be one of: ${TOPOLOGY_IDS.join(', ')}`)

  try {
    const result = service.shortestPath({ source, target, algorithm, topologyId })
    return ok(res, result, `Shortest path via ${result.algorithm} on ${topologyId}`)
  } catch (err) {
    if (err.code === 'BAD_NODE') return badRequest(res, err.message)
    if (err.code === 'NO_PATH')  return notFound(res, err.message)
    throw err
  }
})

// ── Benchmark ─────────────────────────────────────────────────────────────────
// Runs Dijkstra + A* on the same pair and returns a side-by-side comparison.
router.post('/graph/benchmark', authMiddleware, (req, res) => {
  const { source, target, topologyId = DEFAULT_TOPOLOGY } = req.body || {}

  if (!source || !target) return badRequest(res, 'source and target node IDs are required')
  if (!TOPOLOGY_IDS.includes(topologyId)) return badRequest(res, `topologyId must be one of: ${TOPOLOGY_IDS.join(', ')}`)

  try {
    return ok(res, service.benchmark({ source, target, topologyId }), `Benchmark: Dijkstra vs A* on ${topologyId}`)
  } catch (err) {
    if (err.code === 'BAD_NODE') return badRequest(res, err.message)
    if (err.code === 'NO_PATH')  return notFound(res, err.message)
    throw err
  }
})

// ── Path History ──────────────────────────────────────────────────────────────
// Returns last 20 paths computed this server session (newest first).
router.get('/graph/history', authMiddleware, (req, res) =>
  ok(res, service.getHistory(), 'Path computation history')
)

const meta = {
  name: 'telecom-optimizer',
  version: 'v1',
  description: 'High-efficiency routing — Dijkstra + A* running 100% in Node.js across 5 built-in topology templates.',
  active: true,
  tech: ['Node.js', 'Graph Theory', 'React'],
  highlights: [
    '5 built-in topology templates (backbone, metro-ring, hub-spoke, submarine-cable, cdn-mesh)',
    'Dijkstra vs A* benchmark: side-by-side exploration count + admissibility proof',
    'Path history ring buffer: last 20 computed routes persisted in session',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'network_admin', role: 'admin',  description: 'Network administrator' },
    { username: 'analyst',       role: 'viewer', description: 'Network analyst — read only' },
  ],
}

module.exports = { router, meta }
