const { Router } = require('express')
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')
const { ok } = require('../../utils/response')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Banking Core
 *   description: Distributed banking system — fault-tolerant with OAuth2 + JWT, Kafka integration
 */

router.get('/info', (req, res) => ok(res, meta, 'Banking Core module info'))

/**
 * @swagger
 * /api/banking-core/v1/accounts:
 *   get:
 *     tags: [Banking Core]
 *     summary: List accounts (admin/manager only)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/accounts', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  return ok(res, { accounts: [] }, 'Accounts list')
})

/**
 * @swagger
 * /api/banking-core/v1/transactions:
 *   post:
 *     tags: [Banking Core]
 *     summary: Submit a transaction (Kafka-backed)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/transactions', authMiddleware, (req, res) => {
  return ok(res, { txId: null, message: 'Connect Spring Boot Kafka service for transaction processing' }, 'Transaction queued')
})

/**
 * @swagger
 * /api/banking-core/v1/transactions/{id}/status:
 *   get:
 *     tags: [Banking Core]
 *     summary: Get transaction status
 *     security: [{ bearerAuth: [] }]
 */
router.get('/transactions/:id/status', authMiddleware, (req, res) => {
  return ok(res, { txId: req.params.id, status: 'pending' }, 'Transaction status')
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
    'Eventual consistency across distributed services',
  ],
  defaultUsers: [
    { username: 'bank_admin', role: 'admin', description: 'Full banking operations access' },
    { username: 'teller', role: 'manager', description: 'Transaction processing' },
    { username: 'auditor', role: 'viewer', description: 'Read-only audit access' },
  ],
}

module.exports = { router, meta }
