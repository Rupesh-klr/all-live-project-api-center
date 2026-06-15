const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok, paginated, badRequest, notFound } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./banking.service')
const { PUBLIC_ENDPOINTS } = require('./banking.constants')

const router = Router()

// ── PUBLIC ──────────────────────────────────────────────────────────────────────
router.get('/info',   (req, res) => ok(res, meta, 'Banking Core module info'))
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

// ── FX rates (public reference table) ──────────────────────────────────────────
router.get('/fx/rates', (req, res) => ok(res, service.getRates(), 'FX rates'))

// ── Risk Monitor ──────────────────────────────────────────────────────────────
router.get('/risk/alerts', authMiddleware, (req, res) =>
  ok(res, service.getRiskAlerts(), 'Risk alerts')
)

// ── Compliance ────────────────────────────────────────────────────────────────
router.get('/compliance', authMiddleware, (req, res) =>
  ok(res, service.getCompliance(), 'Compliance snapshot')
)

const meta = {
  name: 'banking-core',
  version: 'v1',
  description: 'Fault-tolerant distributed banking core — async settlement, idempotency, risk monitoring, KYC/AML compliance.',
  active: true,
  tech: ['Spring Boot', 'Kafka', 'Microservices'],
  highlights: [
    '99.9% reliability with async 202-accepted transaction model',
    'Rule-based risk alerts: HIGH_VALUE, AML_FLAG, KYC_EXPIRED, CROSS_BORDER',
    'Per-account KYC/AML compliance snapshot with risk scoring',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'bank_admin', role: 'admin',   description: 'Full banking operations access' },
    { username: 'teller',     role: 'manager', description: 'Transaction processing' },
    { username: 'auditor',    role: 'viewer',  description: 'Read-only audit access' },
  ],
}

module.exports = { router, meta }
