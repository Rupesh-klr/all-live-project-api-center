/**
 * WhatsApp CRM — business logic.
 *
 * In-memory inbox with the real 24-hour-window rule: free-form text is only allowed while
 * the window is open (last inbound < 24h ago); otherwise an approved template is required.
 * A "simulate inbound" action reopens the window so the rule can be demonstrated live.
 */
const { WINDOW_MS, DEMO_CONTACTS, TEMPLATES, DEMO_WORKFLOWS } = require('./whatsapp.constants')

let contacts = DEMO_CONTACTS.map(c => ({ ...c, messages: c.messages.map(m => ({ ...m })) }))
let workflows = DEMO_WORKFLOWS.map(w => ({ ...w }))
let mseq = 100

const find = (id) => contacts.find(c => c.id === id)
const windowOpen = (c) => Date.now() - c.lastInboundAt < WINDOW_MS

function summary(c) {
  const last = c.messages[c.messages.length - 1]
  return {
    id: c.id, name: c.name, phone: c.phone,
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
    // Free-form text requires an open window.
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

function withCode(err, code) { err.code = code; return err }

module.exports = {
  listContacts, getMessages, sendMessage, simulateInbound,
  listTemplates, listWorkflows, toggleWorkflow,
}
