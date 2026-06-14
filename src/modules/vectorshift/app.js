const { Router } = require('express')
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')
const { ok } = require('../../utils/response')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: VectorShift
 *   description: Enterprise RAG Pipeline Builder — DAG-based AI workflow orchestration
 */

router.get('/info', (req, res) => ok(res, meta, 'VectorShift module info'))

/**
 * @swagger
 * /api/vectorshift/v1/pipelines:
 *   get:
 *     tags: [VectorShift]
 *     summary: List all RAG pipelines
 *     security: [{ bearerAuth: [] }]
 */
router.get('/pipelines', authMiddleware, (req, res) => {
  return ok(res, { pipelines: [] }, 'Pipelines list')
})

/**
 * @swagger
 * /api/vectorshift/v1/pipelines:
 *   post:
 *     tags: [VectorShift]
 *     summary: Create a new RAG pipeline (DAG definition)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/pipelines', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  return ok(res, { message: 'Pipeline created — connect to FastAPI + vector DB backend' }, 'Created')
})

/**
 * @swagger
 * /api/vectorshift/v1/pipelines/{id}/run:
 *   post:
 *     tags: [VectorShift]
 *     summary: Execute a pipeline query
 *     security: [{ bearerAuth: [] }]
 */
router.post('/pipelines/:id/run', authMiddleware, (req, res) => {
  return ok(res, { result: null, message: 'Connect to FastAPI RAG engine for execution' }, 'Run initiated')
})

const meta = {
  name: 'vectorshift',
  version: 'v1',
  description: 'Enterprise RAG Pipeline Builder — interactive DAG calculator for AI workflow orchestration.',
  active: true,
  tech: ['React', 'FastAPI', 'Vector DBs'],
  highlights: [
    'Interactive DAG-based pipeline builder',
    'High-performance RAG query execution',
    'Vector database indexing',
  ],
  defaultUsers: [
    { username: 'ml_engineer', role: 'admin', description: 'ML engineer — full pipeline control' },
    { username: 'data_analyst', role: 'viewer', description: 'Read-only pipeline viewer' },
  ],
}

module.exports = { router, meta }
