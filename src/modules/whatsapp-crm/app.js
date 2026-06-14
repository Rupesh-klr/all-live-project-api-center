const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { ok, created, paginated, badRequest, notFound, forbidden } = require('../../utils/response')
const { parsePagination, buildPageMeta, paginate } = require('../../utils/pagination')
const service = require('./whatsapp.service')
const { PUBLIC_ENDPOINTS } = require('./whatsapp.constants')

const router = Router()

// ── PUBLIC ──────────────────────────────────────────────────────────────────────
router.get('/info',   (req, res) => ok(res, meta, 'WhatsApp CRM module info'))
router.get('/health', (req, res) => ok(res, { status: 'ok', ts: Date.now() }, 'Healthy'))

router.get('/demo/contacts', (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 10 })
  const all = service.listContacts()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Demo contacts')
})

// Meta WhatsApp inbound webhook (HMAC-verified in production). Kept public + stubbed.
router.post('/webhook', (req, res) => ok(res, { received: true }, 'Webhook received'))

// ── PROTECTED ─────────────────────────────────────────────────────────────────
router.get('/contacts', authMiddleware, (req, res) => {
  const { page, limit } = parsePagination(req, { defaultLimit: 10 })
  const all = service.listContacts()
  return paginated(res, paginate(all, { page, limit }), buildPageMeta({ page, limit, total: all.length }), 'Contacts')
})

router.get('/templates', authMiddleware, (req, res) => ok(res, service.listTemplates(), 'Templates'))

router.get('/contacts/:id/messages', authMiddleware, (req, res) => {
  try {
    return ok(res, service.getMessages(req.params.id), 'Conversation')
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

router.post('/contacts/:id/messages', authMiddleware, (req, res) => {
  try {
    const { text, type, templateId } = req.body || {}
    return ok(res, service.sendMessage({ id: req.params.id, text, type, templateId }), 'Message sent')
  } catch (err) {
    if (err.code === 'WINDOW_CLOSED') return forbidden(res, err.message)
    if (err.code === 'BAD_INPUT')     return badRequest(res, err.message)
    if (err.code === 'NOT_FOUND')     return notFound(res, err.message)
    throw err
  }
})

router.post('/contacts/:id/inbound', authMiddleware, (req, res) => {
  try {
    return ok(res, service.simulateInbound(req.params.id, (req.body || {}).text), 'Inbound simulated')
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

router.get('/workflows', authMiddleware, (req, res) => ok(res, service.listWorkflows(), 'Workflows'))

router.patch('/workflows/:id', authMiddleware, (req, res) => {
  try {
    return ok(res, service.toggleWorkflow(req.params.id), 'Workflow updated')
  } catch (err) {
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics', authMiddleware, (req, res) => ok(res, service.getAnalytics(), 'Analytics'))

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.get('/campaigns', authMiddleware, (req, res) => ok(res, service.listCampaigns(), 'Campaigns'))

router.post('/campaigns', authMiddleware, (req, res) => {
  try {
    return created(res, service.createCampaign(req.body || {}), 'Campaign created')
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    throw err
  }
})

router.patch('/campaigns/:id/send', authMiddleware, (req, res) => {
  try {
    return ok(res, service.sendCampaign(req.params.id), 'Campaign sent')
  } catch (err) {
    if (err.code === 'BAD_INPUT') return badRequest(res, err.message)
    if (err.code === 'NOT_FOUND') return notFound(res, err.message)
    throw err
  }
})

const meta = {
  name: 'whatsapp-crm',
  version: 'v1',
  description: 'Scalable WhatsApp CRM engine — 24h window enforcement, campaigns, no-code workflow automation.',
  active: true,
  tech: ['Node.js', 'WhatsApp API', 'WebHooks'],
  highlights: [
    'WhatsApp Business API integration with 24h window enforcement',
    'Bulk campaign sending with audience segmentation',
    'No-code workflow automation with run-count analytics',
  ],
  publicEndpoints: PUBLIC_ENDPOINTS,
  defaultUsers: [
    { username: 'crm_admin', role: 'admin',   description: 'CRM administrator' },
    { username: 'agent',     role: 'manager', description: 'Customer agent' },
    { username: 'support',   role: 'viewer',  description: 'Support viewer' },
  ],
}

module.exports = { router, meta }
