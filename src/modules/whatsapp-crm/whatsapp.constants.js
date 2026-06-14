/**
 * WhatsApp CRM — module-owned constants & seed inbox.
 *
 * Models the real WhatsApp Business constraints in-memory: each contact has a 24-hour
 * customer-care window. Inside it you may send free-form text; outside it, only an
 * approved template is allowed. Conversations, templates, workflows, and campaigns are seeded here.
 */
const HOUR = 60 * 60 * 1000
const WINDOW_MS = 24 * HOUR
const now = Date.now()

const DEMO_CONTACTS = [
  {
    id: 'C1', name: 'Priya Sharma', phone: '+91 98765 43210', lastInboundAt: now - 5 * 60 * 1000, unread: 2,
    tags: ['vip', 'order-query'], optIn: true,
    messages: [
      { id: 'm1', dir: 'in',  type: 'text', text: 'Hi, is my order shipped?',           ts: now - 9 * 60 * 1000 },
      { id: 'm2', dir: 'out', type: 'text', text: 'Hello Priya! Checking that for you.', ts: now - 7 * 60 * 1000 },
      { id: 'm3', dir: 'in',  type: 'text', text: 'Thanks, also need the invoice.',      ts: now - 5 * 60 * 1000 },
    ],
  },
  {
    id: 'C2', name: 'Rajan Mehta', phone: '+91 87654 32109', lastInboundAt: now - 3 * HOUR, unread: 0,
    tags: ['product-query'], optIn: true,
    messages: [
      { id: 'm1', dir: 'in',  type: 'text', text: 'Do you have the blue variant?',            ts: now - 3 * HOUR },
      { id: 'm2', dir: 'out', type: 'text', text: 'Yes, in stock. Want me to reserve one?',   ts: now - 3 * HOUR + 4 * 60 * 1000 },
    ],
  },
  {
    id: 'C3', name: 'Anita Patel', phone: '+91 76543 21098', lastInboundAt: now - 26 * HOUR, unread: 0,
    tags: ['return'], optIn: true,
    messages: [
      { id: 'm1', dir: 'in',  type: 'text', text: 'Can I return this item?',              ts: now - 26 * HOUR },
      { id: 'm2', dir: 'out', type: 'text', text: 'Of course — I will share the steps.',  ts: now - 26 * HOUR + 6 * 60 * 1000 },
    ],
  },
  {
    id: 'C4', name: 'Vikram Nair', phone: '+91 65432 10987', lastInboundAt: now - 3 * 24 * HOUR, unread: 0,
    tags: ['sales-lead'], optIn: true,
    messages: [
      { id: 'm1', dir: 'in', type: 'text', text: 'Interested in the annual plan.', ts: now - 3 * 24 * HOUR },
    ],
  },
  {
    id: 'C5', name: 'Sara Khan', phone: '+91 90000 11122', lastInboundAt: now - 20 * HOUR, unread: 1,
    tags: ['discount'], optIn: true,
    messages: [
      { id: 'm1', dir: 'in', type: 'text', text: 'Is there a student discount?', ts: now - 20 * HOUR },
    ],
  },
]

// Pre-approved message templates (the only thing allowed outside the 24h window).
const TEMPLATES = [
  { id: 't_reengage', name: 'Re-engagement', category: 'UTILITY',    body: 'Hi {{name}}, we have an update on your request. Reply here to continue the conversation.' },
  { id: 't_invoice',  name: 'Invoice ready', category: 'UTILITY',    body: 'Hi {{name}}, your invoice is ready. Tap below to view and download it.' },
  { id: 't_offer',    name: 'Special offer', category: 'MARKETING',  body: 'Hi {{name}}, a special offer is waiting on your account. Reply YES to learn more.' },
]

const DEMO_WORKFLOWS = [
  { id: 'w1', name: 'Welcome on opt-in',  trigger: 'New contact opt-in',       action: 'Send welcome template',       active: true,  runs: 412 },
  { id: 'w2', name: 'Keyword: PRICE',     trigger: 'Inbound matches "price"',  action: 'Send pricing template',       active: true,  runs: 1290 },
  { id: 'w3', name: 'Cart abandonment',   trigger: 'No reply in 6h',           action: 'Send re-engagement template', active: false, runs: 88 },
  { id: 'w4', name: 'CSAT after resolve', trigger: 'Ticket resolved',           action: 'Send CSAT survey',            active: true,  runs: 233 },
]

const DEMO_CAMPAIGNS = [
  { id: 'camp1', name: 'Black Friday Re-engagement', templateId: 't_offer',    audience: 'window_closed', status: 'sent',  sentCount: 3, openRate: 67, createdAt: now - 7 * 24 * HOUR },
  { id: 'camp2', name: 'Invoice Dispatch Batch',      templateId: 't_invoice',  audience: 'all',           status: 'sent',  sentCount: 5, openRate: 80, createdAt: now - 2 * 24 * HOUR },
  { id: 'camp3', name: 'Customer Satisfaction Poll',  templateId: 't_reengage', audience: 'window_open',   status: 'draft', sentCount: 0, openRate:  0, createdAt: now },
]

const PUBLIC_ENDPOINTS = ['/info', '/health', '/demo/contacts']

module.exports = { WINDOW_MS, DEMO_CONTACTS, TEMPLATES, DEMO_WORKFLOWS, DEMO_CAMPAIGNS, PUBLIC_ENDPOINTS }
