/**
 * Banking Core — business logic.
 *
 * Async transaction model: submit() accepts and returns immediately (202-style), the
 * status advances lazily on poll (pending → processing → settled), balances apply once
 * settled. Idempotency key prevents double-submission. Risk alerts and compliance
 * snapshots are computed from the in-memory account and transaction state.
 */
const { DEMO_ACCOUNTS, ACCOUNT_COMPLIANCE, SEED_RISK_ALERTS, TIMING } = require('./banking.constants')

let accounts  = DEMO_ACCOUNTS.map(a => ({ ...a }))
const txById  = new Map()
const idempotency = new Map()
let seq = 1

function listAccounts() { return accounts }

function settleIfNeeded(tx) {
  if (tx.status === 'settled' || tx.status === 'failed') return tx
  const elapsed = Date.now() - tx.acceptedAt
  if (elapsed >= TIMING.SETTLED_AFTER_MS && !tx.applied) {
    tx.status = 'settled'
    tx.applied = true
    const from = accounts.find(a => a.id === tx.from)
    if (from) from.balance = Math.max(0, from.balance - tx.amount)
    const to = accounts.find(a => a.id === tx.to)
    if (to) to.balance += tx.amount
  } else if (elapsed >= TIMING.PROCESSING_AFTER_MS) {
    tx.status = 'processing'
  }
  return tx
}

function submitTransaction({ from, to, amount, idempotencyKey }) {
  const fromAcc = accounts.find(a => a.id === from)
  const toAcc   = accounts.find(a => a.id === to)
  if (!fromAcc) throw withCode(new Error(`Source account "${from}" not found`), 'NOT_FOUND')
  if (!toAcc)   throw withCode(new Error(`Destination account "${to}" not found`), 'NOT_FOUND')
  if (!amount || isNaN(amount) || Number(amount) <= 0) throw withCode(new Error('amount must be a positive number'), 'BAD_INPUT')
  if (from === to) throw withCode(new Error('Source and destination must differ'), 'BAD_INPUT')

  amount = Number(amount)

  if (idempotencyKey && idempotency.has(idempotencyKey)) {
    const existing = txById.get(idempotency.get(idempotencyKey))
    return { ...publicTx(settleIfNeeded(existing)), idempotentReplay: true }
  }

  const tx = {
    id: `TX-${String(seq++).padStart(5, '0')}`,
    from, to, amount,
    currency: fromAcc.currency,
    idempotencyKey: idempotencyKey || null,
    status: 'pending',
    applied: false,
    acceptedAt: Date.now(),
    createdAt: new Date().toISOString(),
  }
  txById.set(tx.id, tx)
  if (idempotencyKey) idempotency.set(idempotencyKey, tx.id)
  return { ...publicTx(tx), idempotentReplay: false }
}

function getStatus(txId) {
  const tx = txById.get(txId)
  if (!tx) throw withCode(new Error('Transaction not found'), 'NOT_FOUND')
  return publicTx(settleIfNeeded(tx))
}

function listTransactions() {
  return [...txById.values()].map(settleIfNeeded).sort((a, b) => b.acceptedAt - a.acceptedAt).map(publicTx)
}

function publicTx(tx) {
  return {
    id: tx.id, from: tx.from, to: tx.to, amount: tx.amount, currency: tx.currency,
    status: tx.status, idempotencyKey: tx.idempotencyKey, createdAt: tx.createdAt,
  }
}

// ── Risk Monitor ──────────────────────────────────────────────────────────────

function getRiskAlerts() {
  const alerts = [...SEED_RISK_ALERTS]

  // Dynamic: flag any API-submitted transaction over 100 000
  for (const tx of txById.values()) {
    settleIfNeeded(tx)
    const dynId = `ra_${tx.id}`
    if (tx.amount > 100000 && !alerts.find(a => a.id === dynId)) {
      alerts.push({
        id: dynId,
        type: 'HIGH_VALUE',
        severity: 'medium',
        message: `Transaction ${tx.id} of ${tx.currency} ${tx.amount.toLocaleString()} submitted via API exceeds high-value threshold`,
        accountId: tx.from,
        ts: tx.acceptedAt,
      })
    }
  }

  return alerts.sort((a, b) => b.ts - a.ts)
}

// ── Compliance ────────────────────────────────────────────────────────────────

function getCompliance() {
  return accounts.map(a => ({
    accountId: a.id,
    name: a.name,
    currency: a.currency,
    type: a.type,
    ...(ACCOUNT_COMPLIANCE[a.id] || { kycStatus: 'pending', amlFlag: 'clear', riskScore: 0, lastReviewed: null }),
  }))
}

function withCode(err, code) { err.code = code; return err }

module.exports = { listAccounts, submitTransaction, getStatus, listTransactions, getRiskAlerts, getCompliance }
