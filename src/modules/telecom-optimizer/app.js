const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok, paginated, badRequest, notFound } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./telecom.service')
const { ALGORITHMS, DEFAULT_ALGORITHM, PUBLIC_ENDPOINTS } = require('./telecom.constants')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Telecom Optimizer
 *   description: High-efficiency routing — Graph Theory based network path detection
 */

// ── PUBLIC ENDPOINTS (no auth — safe to share with a recruiter) ────────────────

/**
 * @swagger
 * /api/telecom-optimizer/v1/info:
 *   get: { tags: [Telecom Optimizer], summary: Module info and project summary }
 */
router.get('/info', (req, res) => ok(res, { ...meta, graph: service.getInfo() }, 'Telecom Optimizer info'))

/**
 * @swagger
 * /api/telecom-optimizer/v1/health:
 *   get: { tags: [Telecom Optimizer], summary: Liveness probe }
 */
router.get('/health', (req, res) => ok(res, { status: 'ok', ts: Date.now() }, 'Healthy'))

/**
 * @swagger
 * /api/telecom-optimizer/v1/demo/nodes:
 *   get:
 *     tags: [Telecom Optimizer]
 *     summary: Public, paginated demo network nodes
 *     parameters:
 *       - { in: query, name: page,  schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 */
router.get('/demo/nodes', (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const all = service.getNodes()
  const items = paginate(all, { page, limit })
  return paginated(res, items, buildPageMeta({ page, limit, total: all.length }), 'Demo network nodes')
})

// ── PROTECTED ENDPOINTS (Bearer token required) ────────────────────────────────

/**
 * @swagger
 * /api/telecom-optimizer/v1/nodes:
 *   get:
 *     tags: [Telecom Optimizer]
 *     summary: Paginated network nodes (auth required)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/nodes', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const all = service.getNodes()
  const items = paginate(all, { page, limit })
  return paginated(res, items, buildPageMeta({ page, limit, total: all.length }), 'Network nodes')
})

/**
 * @swagger
 * /api/telecom-optimizer/v1/graph/shortest-path:
 *   post:
 *     tags: [Telecom Optimizer]
 *     summary: Run Dijkstra / A* between two nodes
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source:    { type: string, example: N1 }
 *               target:    { type: string, example: N12 }
 *               algorithm: { type: string, enum: [dijkstra, astar] }
 */
router.post('/graph/shortest-path', authMiddleware, (req, res) => {
  const { source, target, algorithm = DEFAULT_ALGORITHM } = req.body || {}

  if (!source || !target) return badRequest(res, 'source and target node IDs are required')
  if (algorithm && !ALGORITHMS.includes(algorithm)) {
    return badRequest(res, `algorithm must be one of: ${ALGORITHMS.join(', ')}`)
  }

  try {
    const result = service.shortestPath({ source, target, algorithm })
    return ok(res, result, `Shortest path via ${result.algorithm}`)
  } catch (err) {
    if (err.code === 'BAD_NODE') return badRequest(res, err.message)
    if (err.code === 'NO_PATH')  return notFound(res, err.message)
    throw err
  }
})

const meta = {
  name: 'telecom-optimizer',
  version: 'v1',
  description: 'High-efficiency routing algorithm using Python + Graph Theory. 130% increase in path detection speed.',
  active: true,
  tech: ['Python', 'Graph Theory', 'React'],
  highlights: [
    '130% increase in path detection speed',
    '40% improvement in signal latency analysis',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'network_admin', role: 'admin', description: 'Network administrator' },
    { username: 'analyst', role: 'viewer', description: 'Network analyst — read only' },
  ],
}

module.exports = { router, meta }
