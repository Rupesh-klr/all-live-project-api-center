const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok, paginated, badRequest, notFound } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./banking.service')
const { PUBLIC_ENDPOINTS } = require('./banking.constants')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Banking Core
 *   description: Distributed banking — async transactions, idempotency, settlement
 */

// ── PUBLIC ──────────────────────────────────────────────────────────────────────
router.get('/info', (req, res) => ok(res, meta, 'Banking Core module info'))
router.get('/health', (req, res) => ok(res, { status: 'ok', ts: Date.now() }, 'Healthy'))

router.get('/demo/accounts', (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 6 })
  const all = service.listAccounts()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Demo accounts')
})

// ── PROTECTED ─────────────────────────────────────────────────────────────────
router.get('/accounts', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 6 })
  const all = service.listAccounts()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Accounts')
})

/**
 * Submit a transaction. Returns 202 Accepted immediately — the client polls
 * /transactions/:id/status for the settlement lifecycle.
 */
router.post('/transactions', authMiddleware, (req, res) => {
  try {
    const tx = service.submitTransaction(req.body || {})
    return res.status(202).json({ success: true, message: 'Transaction accepted', data: tx })
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

router.get('/transactions/:id/status', authMiddleware, (req, res) => {
  try {
    return ok(res, service.getStatus(req.params.id), 'Transaction status')
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

router.get('/transactions', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 8 })
  const all = service.listTransactions()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Transaction ledger')
})

const meta = {
  name: 'banking-core',
  version: 'v1',
  description: 'Fault-tolerant distributed banking core — Spring Boot, Kafka, 99.9% reliability.',
  active: true,
  tech: ['Spring Boot', 'Kafka', 'Microservices'],
  highlights: [
    '99.9% reliability with Kafka event streaming',
    'OAuth2 + JWT banking-grade security',
    'Idempotent, eventually-consistent transactions',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'bank_admin', role: 'admin', description: 'Full banking operations access' },
    { username: 'teller', role: 'manager', description: 'Transaction processing' },
    { username: 'auditor', role: 'viewer', description: 'Read-only audit access' },
  ],
}

module.exports = { router, meta }
