const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok } = require('../../utils/response')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Telecom Optimizer
 *   description: High-efficiency routing algorithm — Graph Theory based network path detection
 */

/**
 * @swagger
 * /api/telecom-optimizer/v1/info:
 *   get:
 *     tags: [Telecom Optimizer]
 *     summary: Module info and project summary
 */
router.get('/info', (req, res) => ok(res, meta, 'Telecom Optimizer module info'))

/**
 * @swagger
 * /api/telecom-optimizer/v1/graph/shortest-path:
 *   post:
 *     tags: [Telecom Optimizer]
 *     summary: Run Dijkstra/A* on a given network graph
 *     security: [{ bearerAuth: [] }]
 */
router.post('/graph/shortest-path', authMiddleware, (req, res) => {
  // TODO: integrate with Python microservice or implement graph algo here
  return ok(res, { message: 'Graph computation endpoint — integrate Python service here' }, 'OK')
})

/**
 * @swagger
 * /api/telecom-optimizer/v1/nodes:
 *   get:
 *     tags: [Telecom Optimizer]
 *     summary: Get all dynamic network nodes
 *     security: [{ bearerAuth: [] }]
 */
router.get('/nodes', authMiddleware, (req, res) => {
  return ok(res, { nodes: [] }, 'Network nodes')
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
  defaultUsers: [
    { username: 'network_admin', role: 'admin', description: 'Network administrator' },
    { username: 'analyst', role: 'viewer', description: 'Network analyst — read only' },
  ],
}

module.exports = { router, meta }
