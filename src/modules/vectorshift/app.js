const { Router } = require('express')
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')
const { ok, created, paginated, badRequest, notFound } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./vectorshift.service')
const { PUBLIC_ENDPOINTS } = require('./vectorshift.constants')

const router = Router()

// ── PUBLIC ──────────────────────────────────────────────────────────────────────
router.get('/info',    (req, res) => ok(res, meta, 'VectorShift module info'))
router.get('/health',  (req, res) => ok(res, { status: 'ok', ts: Date.now() }, 'Healthy'))
router.get('/options', (req, res) => ok(res, service.options(), 'Pipeline building blocks'))

router.get('/demo/pipelines', (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const all = service.listPipelines()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Demo pipelines')
})

// ── PROTECTED ─────────────────────────────────────────────────────────────────
router.get('/pipelines', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 5 })
  const all = service.listPipelines()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Pipelines')
})

router.post('/pipelines', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  try {
    return created(res, service.createPipeline(req.body || {}), 'Pipeline created')
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    throw err
  }
})

router.post('/pipelines/:id/run', authMiddleware, (req, res) => {
  try {
    const { query, mmr, lambda } = req.body || {}
    const result = service.runQuery({ pipelineId: req.params.id, query, mmr, lambda })
    return ok(res, result, 'Query executed')
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

router.delete('/pipelines/:id', authMiddleware, requireRole(['admin']), (req, res) => {
  try {
    return ok(res, service.deletePipeline(req.params.id), 'Pipeline deleted')
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

// ── Knowledge Base ─────────────────────────────────────────────────────────────
router.get('/knowledge', authMiddleware, (req, res) =>
  ok(res, service.listKnowledge(req.query), 'Knowledge chunks')
)

router.post('/knowledge', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  try {
    return created(res, service.addKnowledge(req.body || {}), 'Chunk added')
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    throw err
  }
})

// ── Models ────────────────────────────────────────────────────────────────────
router.get('/models', authMiddleware, (req, res) => ok(res, service.listModels(), 'LLM models'))

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get('/metrics', authMiddleware, (req, res) => ok(res, service.getMetrics(), 'Query metrics'))

const meta = {
  name: 'vectorshift',
  version: 'v1',
  description: 'Enterprise RAG Pipeline Builder — interactive DAG calculator for AI workflow orchestration.',
  active: true,
  tech: ['React', 'FastAPI', 'Vector DBs'],
  highlights: [
    'Interactive DAG-based pipeline builder with 4 LLM model options',
    'Keyword-overlap RAG with scored source chunks — no external vector DB needed',
    'Live session metrics: query volume, avg similarity, top query frequency',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'ml_engineer',  role: 'admin',  description: 'ML engineer — full pipeline control' },
    { username: 'data_analyst', role: 'viewer', description: 'Read-only pipeline viewer' },
  ],
}

module.exports = { router, meta }
