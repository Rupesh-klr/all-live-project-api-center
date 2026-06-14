/**
 * WhatsApp CRM — business logic.
 *
 * In-memory inbox with the real 24-hour-window rule: free-form text is only allowed while
 * the window is open (last inbound < 24h ago); otherwise an approved template is required.
 * A "simulate inbound" action reopens the window so the rule can be demonstrated live.
 */
const { WINDOW_MS, DEMO_CONTACTS, TEMPLATES, DEMO_WORKFLOWS, DEMO_CAMPAIGNS } = require('./whatsapp.constants')

let contacts  = DEMO_CONTACTS.map(c => ({ ...c, messages: c.messages.map(m => ({ ...m })) }))
let workflows = DEMO_WORKFLOWS.map(w => ({ ...w }))
let campaigns = DEMO_CAMPAIGNS.map(c => ({ ...c }))
let mseq = 100

const find       = (id) => contacts.find(c => c.id === id)
const windowOpen = (c)  => Date.now() - c.lastInboundAt < WINDOW_MS

function summary(c) {
  const last = c.messages[c.messages.length - 1]
  return {
    id: c.id, name: c.name, phone: c.phone, tags: c.tags || [], optIn: c.optIn ?? true,
    unread: c.unread,
    windowOpen: windowOpen(c),
    lastInboundAt: c.lastInboundAt,
    preview: last ? `${last.dir === 'out' ? 'You: ' : ''}${last.text}` : '',
    lastTs: last ? last.ts : c.lastInboundAt,
  }
}

function listContacts() {
  return [...contacts].sort((a, b) => b.lastInboundAt - a.lastInboundAt).map(summary)
}

function getMessages(id) {
  const c = find(id)
  if (!c) throw withCode(new Error('Contact not found'), 'NOT_FOUND')
  c.unread = 0
  return { id: c.id, name: c.name, phone: c.phone, windowOpen: windowOpen(c), messages: c.messages }
}

function sendMessage({ id, text, type = 'text', templateId }) {
  const c = find(id)
  if (!c) throw withCode(new Error('Contact not found'), 'NOT_FOUND')

  const open = windowOpen(c)
  let body = text

  if (type === 'template') {
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (!tpl) throw withCode(new Error('Unknown template'), 'BAD_INPUT')
    body = tpl.body.replace('{{name}}', c.name.split(' ')[0])
  } else {
    if (!open) throw withCode(new Error('Outside the 24-hour window — an approved template is required'), 'WINDOW_CLOSED')
    if (!text || !text.trim()) throw withCode(new Error('Message text is required'), 'BAD_INPUT')
  }

  const msg = { id: `m${mseq++}`, dir: 'out', type, text: body, ts: Date.now(), templateId: templateId || null }
  c.messages.push(msg)
  return { contactId: c.id, windowOpen: windowOpen(c), message: msg }
}

// Simulate an inbound customer reply — reopens the 24h window (great for the demo).
function simulateInbound(id, text = 'Yes, please continue 👍') {
  const c = find(id)
  if (!c) throw withCode(new Error('Contact not found'), 'NOT_FOUND')
  const msg = { id: `m${mseq++}`, dir: 'in', type: 'text', text, ts: Date.now() }
  c.messages.push(msg)
  c.lastInboundAt = Date.now()
  c.unread = 0
  return { contactId: c.id, windowOpen: true, message: msg }
}

function listTemplates() { return TEMPLATES }

function listWorkflows() { return workflows }

function toggleWorkflow(id) {
  const w = workflows.find(x => x.id === id)
  if (!w) throw withCode(new Error('Workflow not found'), 'NOT_FOUND')
  w.active = !w.active
  return w
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function getAnalytics() {
  const total   = contacts.length
  const open    = contacts.filter(windowOpen).length
  const allMsgs = contacts.flatMap(c => c.messages)
  const inbound      = allMsgs.filter(m => m.dir === 'in').length
  const outbound     = allMsgs.filter(m => m.dir === 'out').length
  const templatesSent = allMsgs.filter(m => m.type === 'template').length
  const totalWfRuns  = workflows.reduce((s, w) => s + w.runs, 0)
  const topWf = [...workflows].sort((a, b) => b.runs - a.runs)[0] || null

  return {
    totalContacts: total,
    windowOpenRate: Math.round(open / total * 100),
    totalMessages: allMsgs.length,
    inbound,
    outbound,
    templatesSent,
    responseRate: outbound > 0 ? Math.round(inbound / outbound * 100) : 0,
    activeWorkflows: workflows.filter(w => w.active).length,
    totalWorkflowRuns: totalWfRuns,
    topWorkflow: topWf ? { name: topWf.name, runs: topWf.runs } : null,
    contactsByWindow: { open, closed: total - open },
  }
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

function listCampaigns() { return campaigns }

function createCampaign({ name, templateId, audience }) {
  if (!name?.trim()) throw withCode(new Error('Campaign name is required'), 'BAD_INPUT')
  if (!TEMPLATES.find(t => t.id === templateId)) throw withCode(new Error('Unknown template ID'), 'BAD_INPUT')
  const valid = ['all', 'window_open', 'window_closed']
  if (!valid.includes(audience)) throw withCode(new Error(`audience must be one of: ${valid.join(', ')}`), 'BAD_INPUT')

  const c = {
    id: `camp${Date.now()}`, name: name.trim(), templateId, audience,
    status: 'draft', sentCount: 0, openRate: 0, createdAt: Date.now(),
  }
  campaigns.push(c)
  return c
}

function sendCampaign(id) {
  const c = campaigns.find(x => x.id === id)
  if (!c) throw withCode(new Error('Campaign not found'), 'NOT_FOUND')
  if (c.status === 'sent') throw withCode(new Error('Campaign already sent'), 'BAD_INPUT')

  const tpl = TEMPLATES.find(t => t.id === c.templateId)
  if (!tpl) throw withCode(new Error('Template not found'), 'NOT_FOUND')

  let audience
  if (c.audience === 'all')          audience = contacts
  else if (c.audience === 'window_open')  audience = contacts.filter(windowOpen)
  else                               audience = contacts.filter(ct => !windowOpen(ct))

  for (const ct of audience) {
    const body = tpl.body.replace('{{name}}', ct.name.split(' ')[0])
    ct.messages.push({ id: `m${mseq++}`, dir: 'out', type: 'template', text: body, ts: Date.now(), templateId: c.templateId })
  }

  c.sentCount = audience.length
  c.status    = 'sent'
  c.openRate  = 55 + Math.floor(Math.random() * 30) // 55–85 % simulated open rate
  c.sentAt    = Date.now()
  return c
}

function withCode(err, code) { err.code = code; return err }

module.exports = {
  listContacts, getMessages, sendMessage, simulateInbound,
  listTemplates, listWorkflows, toggleWorkflow,
  getAnalytics, listCampaigns, createCampaign, sendCampaign,
}
