/**
 * Banking Core — business logic.
 *
 * Async transaction model: submit() accepts and returns immediately (202-style), the
 * status advances lazily on poll (pending → processing → settled), balances apply once
 * on settlement, and an idempotencyKey guarantees a retry never double-charges.
 */
const { DEMO_ACCOUNTS, TIMING } = require('./banking.constants')

// In-memory stores (reset on restart).
let accounts = DEMO_ACCOUNTS.map(a => ({ ...a }))
const txById = new Map()          // txId -> transaction
const idempotency = new Map()     // idempotencyKey -> txId
let seq = 1

const accountById = (id) => accounts.find(a => a.id === id)

function listAccounts() {
  return accounts
}

function computeStatus(tx) {
  if (tx.status === 'failed' || tx.status === 'settled') return tx.status
  const elapsed = Date.now() - tx.acceptedAt
  if (elapsed >= TIMING.SETTLED_AFTER_MS) return 'settled'
  if (elapsed >= TIMING.PROCESSING_AFTER_MS) return 'processing'
  return 'pending'
}

// Apply balances exactly once when a transaction first reaches 'settled'.
function settleIfNeeded(tx) {
  const status = computeStatus(tx)
  if (status === 'settled' && !tx.applied) {
    const from = accountById(tx.from)
    const to = accountById(tx.to)
    if (from) from.balance = Math.round((from.balance - tx.amount) * 100) / 100
    if (to)   to.balance = Math.round((to.balance + tx.amount) * 100) / 100
    tx.applied = true
    tx.settledAt = Date.now()
  }
  tx.status = status
  return tx
}

function submitTransaction({ from, to, amount, idempotencyKey }) {
  amount = Number(amount)

  if (!from || !to) throw withCode(new Error('from and to account IDs are required'), 'BAD_INPUT')
  if (from === to) throw withCode(new Error('from and to accounts must differ'), 'BAD_INPUT')
  if (!Number.isFinite(amount) || amount <= 0) throw withCode(new Error('amount must be a positive number'), 'BAD_INPUT')

  const fromAcc = accountById(from)
  const toAcc = accountById(to)
  if (!fromAcc) throw withCode(new Error(`Unknown source account ${from}`), 'NOT_FOUND')
  if (!toAcc) throw withCode(new Error(`Unknown destination account ${to}`), 'NOT_FOUND')
  if (fromAcc.balance < amount) throw withCode(new Error('Insufficient funds in source account'), 'BAD_INPUT')

  // Idempotent replay — return the original transaction, never a second charge.
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
  // Settle any that are due, newest first.
  return [...txById.values()].map(settleIfNeeded).sort((a, b) => b.acceptedAt - a.acceptedAt).map(publicTx)
}

function publicTx(tx) {
  return {
    id: tx.id, from: tx.from, to: tx.to, amount: tx.amount, currency: tx.currency,
    status: tx.status, idempotencyKey: tx.idempotencyKey, createdAt: tx.createdAt,
  }
}

function withCode(err, code) { err.code = code; return err }

module.exports = { listAccounts, submitTransaction, getStatus, listTransactions }
