/**
 * Banking Core — module-owned constants & seed accounts.
 *
 * Models the real async banking pattern in-memory: a transaction is accepted (202),
 * runs through pending → processing → settled, and is idempotent on retry. No Kafka
 * needed for the demo; the state machine advances on elapsed time.
 */

const DEMO_ACCOUNTS = [
  { id: 'ACC-1001', name: 'Operating Account', currency: 'USD', balance: 184230.55, type: 'checking' },
  { id: 'ACC-1002', name: 'Payroll Reserve',   currency: 'USD', balance: 92450.00,  type: 'reserve'  },
  { id: 'ACC-1003', name: 'Tax Holding',        currency: 'USD', balance: 38900.75,  type: 'holding'  },
  { id: 'ACC-2001', name: 'EU Settlement',      currency: 'EUR', balance: 47820.10,  type: 'settlement' },
  { id: 'ACC-3001', name: 'APAC Treasury',      currency: 'SGD', balance: 210500.00, type: 'treasury' },
  { id: 'ACC-4001', name: 'Merchant Float',     currency: 'GBP', balance: 15640.20,  type: 'float'    },
]

// State-machine timings (ms since acceptance) — fast enough for a live demo poll.
const TIMING = {
  PROCESSING_AFTER_MS: 1200,
  SETTLED_AFTER_MS:    3200,
}

const STATES = ['pending', 'processing', 'settled', 'failed']

const PUBLIC_ENDPOINTS = ['/info', '/health', '/demo/accounts']

module.exports = { DEMO_ACCOUNTS, TIMING, STATES, PUBLIC_ENDPOINTS }
