const { Router } = require('express')
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')
const { ok } = require('../../utils/response')

const router = Router()

/**
 * @swagger
 * tags:
 *   name: WhatsApp CRM
 *   description: Automated WhatsApp CRM — webhook-driven client communication engine
 */

router.get('/info', (req, res) => ok(res, meta, 'WhatsApp CRM module info'))

/**
 * @swagger
 * /api/whatsapp-crm/v1/webhook:
 *   post:
 *     tags: [WhatsApp CRM]
 *     summary: WhatsApp Business API incoming webhook
 */
router.post('/webhook', (req, res) => {
  // WhatsApp webhook verification + message handling
  return ok(res, { received: true }, 'Webhook received')
})

/**
 * @swagger
 * /api/whatsapp-crm/v1/contacts:
 *   get:
 *     tags: [WhatsApp CRM]
 *     summary: List CRM contacts
 *     security: [{ bearerAuth: [] }]
 */
router.get('/contacts', authMiddleware, (req, res) => {
  return ok(res, { contacts: [] }, 'Contacts')
})

/**
 * @swagger
 * /api/whatsapp-crm/v1/messages/send:
 *   post:
 *     tags: [WhatsApp CRM]
 *     summary: Send a WhatsApp message to a contact
 *     security: [{ bearerAuth: [] }]
 */
router.post('/messages/send', authMiddleware, requireRole(['admin', 'manager']), (req, res) => {
  return ok(res, { messageId: null, message: 'Connect WhatsApp Business API credentials' }, 'Message queued')
})

/**
 * @swagger
 * /api/whatsapp-crm/v1/workflows:
 *   get:
 *     tags: [WhatsApp CRM]
 *     summary: List automation workflows
 *     security: [{ bearerAuth: [] }]
 */
router.get('/workflows', authMiddleware, (req, res) => {
  return ok(res, { workflows: [] }, 'Workflows')
})

const meta = {
  name: 'whatsapp-crm',
  version: 'v1',
  description: 'Scalable WhatsApp CRM engine — event-driven webhook processing, fault-tolerant real-time sync.',
  active: true,
  tech: ['Node.js', 'Spring Boot', 'WebHooks'],
  highlights: [
    'WhatsApp Business API integration',
    'High-concurrency webhook processing',
    'Custom workflow automation',
  ],
  defaultUsers: [
    { username: 'crm_admin', role: 'admin', description: 'CRM administrator' },
    { username: 'agent', role: 'manager', description: 'Customer agent' },
    { username: 'support', role: 'viewer', description: 'Support viewer' },
  ],
}

module.exports = { router, meta }
