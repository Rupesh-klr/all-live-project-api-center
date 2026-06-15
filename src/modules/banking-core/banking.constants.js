/**
 * Banking Core — module-owned constants & seed accounts.
 *
 * Models the real async banking pattern in-memory: a transaction is accepted (202),
 * runs through pending → processing → settled, and is idempotent on retry. No Kafka
 * needed for the demo; the state machine advances on elapsed time.
 */

const DEMO_ACCOUNTS = [
  { id: 'ACC-1001', name: 'Operating Account', currency: 'USD', balance: 184230.55, type: 'checking'   },
  { id: 'ACC-1002', name: 'Payroll Reserve',   currency: 'USD', balance: 92450.00,  type: 'reserve'    },
  { id: 'ACC-1003', name: 'Tax Holding',        currency: 'USD', balance: 38900.75,  type: 'holding'    },
  { id: 'ACC-2001', name: 'EU Settlement',      currency: 'EUR', balance: 47820.10,  type: 'settlement' },
  { id: 'ACC-3001', name: 'APAC Treasury',      currency: 'SGD', balance: 210500.00, type: 'treasury'   },
  { id: 'ACC-4001', name: 'Merchant Float',     currency: 'GBP', balance: 15640.20,  type: 'float'      },
]

// Per-account KYC + AML compliance snapshot.
const ACCOUNT_COMPLIANCE = {
  'ACC-1001': { kycStatus: 'verified', amlFlag: 'clear',   riskScore: 28, lastReviewed: '2026-05-10' },
  'ACC-1002': { kycStatus: 'verified', amlFlag: 'clear',   riskScore: 15, lastReviewed: '2026-05-12' },
  'ACC-1003': { kycStatus: 'verified', amlFlag: 'clear',   riskScore: 22, lastReviewed: '2026-05-08' },
  'ACC-2001': { kycStatus: 'verified', amlFlag: 'review',  riskScore: 61, lastReviewed: '2026-05-01' },
  'ACC-3001': { kycStatus: 'pending',  amlFlag: 'flagged', riskScore: 83, lastReviewed: '2026-04-20' },
  'ACC-4001': { kycStatus: 'verified', amlFlag: 'clear',   riskScore: 18, lastReviewed: '2026-05-14' },
}

// Seed risk alerts — static scenarios shown before any live transactions are submitted.
const SEED_RISK_ALERTS = [
  {
    id: 'ra1', type: 'HIGH_VALUE',   severity: 'high',
    message: 'Single outbound SGD 210,500 from APAC Treasury (ACC-3001) exceeds high-value threshold',
    accountId: 'ACC-3001', ts: Date.now() - 5 * 60 * 1000,
  },
  {
    id: 'ra2', type: 'AML_FLAG',     severity: 'high',
    message: 'ACC-3001 (APAC Treasury) carries an active AML investigation flag from compliance team',
    accountId: 'ACC-3001', ts: Date.now() - 2 * 24 * 3600000,
  },
  {
    id: 'ra3', type: 'KYC_EXPIRED',  severity: 'medium',
    message: 'ACC-3001 KYC renewal overdue — last verified 55 days ago; re-verification required',
    accountId: 'ACC-3001', ts: Date.now() - 3 * 24 * 3600000,
  },
  {
    id: 'ra4', type: 'CROSS_BORDER', severity: 'medium',
    message: 'EU Settlement (ACC-2001) flagged for cross-border pattern review on EUR 47,820 batch',
    accountId: 'ACC-2001', ts: Date.now() - 1 * 24 * 3600000,
  },
  {
    id: 'ra5', type: 'LOW_BALANCE',  severity: 'low',
    message: 'Merchant Float (ACC-4001) balance GBP 15,640 approaching minimum operating level',
    accountId: 'ACC-4001', ts: Date.now() - 30 * 60 * 1000,
  },
]

// FX rates relative to USD — 1 unit of the currency = N USD.
// Cross-currency transfers are converted at fromRate/toRate (see banking.service.js).
const FX_RATES = {
  USD: 1.00,
  EUR: 1.08,
  SGD: 0.74,
  GBP: 1.27,
}

// State-machine timings (ms since acceptance) — fast enough for a live demo poll.
const TIMING = {
  PROCESSING_AFTER_MS: 1200,
  SETTLED_AFTER_MS:    3200,
}

const STATES = ['pending', 'processing', 'settled', 'failed']

const PUBLIC_ENDPOINTS = ['/info', '/health', '/demo/accounts']

module.exports = { DEMO_ACCOUNTS, ACCOUNT_COMPLIANCE, SEED_RISK_ALERTS, FX_RATES, TIMING, STATES, PUBLIC_ENDPOINTS }
