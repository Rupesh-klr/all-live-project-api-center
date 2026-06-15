# Module: banking-core

> **🔗 Live API:** https://all-live-project-api-center-rupesh-klr.holistichealervedika.com/api/banking-core/v1/info (public)

> Node.js · Express · Kafka (bridge) · Idempotency · Distributed Transactions

Distributed Banking Core — high-throughput transaction processing API with event-driven submission. Transactions are published to Kafka and processed asynchronously; the status endpoint polls the result. Designed for 99.9% fault-tolerance with idempotency key support to prevent duplicate transactions.

**Portfolio story:** Demonstrates distributed systems design — not a simple CRUD API. Submission is async (fire + poll), idempotency is enforced, and account operations are restricted to authorised roles. Kafka bridge is plug-in ready.

---

## Endpoints

Base path: `/api/banking-core/v1/`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/info` | Public | Module metadata |
| `GET`  | `/accounts` | admin / manager | List all accounts |
| `GET`  | `/accounts/:id` | Bearer | Get account by ID (own account or admin) |
| `POST` | `/transactions` | Bearer | Submit a transaction — published to Kafka (or stub) |
| `GET`  | `/transactions/:id/status` | Bearer | Poll transaction processing status |
| `GET`  | `/transactions` | admin / manager | List all transactions |

---

## GET `/accounts`

```http
GET /api/banking-core/v1/accounts
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

Only `admin` and `manager` roles can see all accounts. A `viewer` or `guest` calling this endpoint receives `403`.

```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id":       "ACC001",
        "holder":   "Alice Sharma",
        "balance":  50000.00,
        "currency": "USD",
        "status":   "active",
        "createdAt":"2026-01-15T08:00:00.000Z"
      },
      {
        "id":       "ACC002",
        "holder":   "Bob Mehta",
        "balance":  12500.00,
        "currency": "USD",
        "status":   "active",
        "createdAt":"2026-02-10T08:00:00.000Z"
      }
    ],
    "total": 2
  }
}
```

---

## POST `/transactions`

```http
POST /api/banking-core/v1/transactions
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "fromAccount":    "ACC001",
  "toAccount":      "ACC002",
  "amount":         1500.00,
  "currency":       "USD",
  "reference":      "INV-2026-0614",
  "idempotencyKey": "txn_client_uuid_abc123"
}
```

| Field | Required | Notes |
|---|---|---|
| `fromAccount` | Yes | Must exist and be active |
| `toAccount` | Yes | Must exist and be active |
| `amount` | Yes | Positive number, max 2 decimal places |
| `currency` | Yes | ISO 4217 code |
| `reference` | No | Free-text memo visible to both parties |
| `idempotencyKey` | Yes | Client-generated unique key — same key returns the first result on retry |

**Response (202 Accepted — async submission):**

```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_xyz789",
    "status":        "pending",
    "submittedAt":   "2026-06-14T08:00:00.000Z",
    "idempotencyKey":"txn_client_uuid_abc123"
  }
}
```

`202 Accepted` — not `201 Created` — because the transaction is queued, not yet processed.

**Idempotency:** If the same `idempotencyKey` is submitted twice, the second call returns the first transaction's data unchanged. Safe to retry on network failure.

---

## GET `/transactions/:id/status`

```http
GET /api/banking-core/v1/transactions/TXN_xyz789/status
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_xyz789",
    "status":        "settled",
    "fromAccount":   "ACC001",
    "toAccount":     "ACC002",
    "amount":        1500.00,
    "currency":      "USD",
    "submittedAt":   "2026-06-14T08:00:00.000Z",
    "settledAt":     "2026-06-14T08:00:05.000Z"
  }
}
```

**Status lifecycle:**

```
pending → processing → settled
                    → failed (reason included in response)
```

Poll this endpoint at 1–2 second intervals until status is `settled` or `failed`.

---

## Kafka bridge

Set `KAFKA_BROKERS` to activate the live event stream:

```env
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_TRANSACTIONS=banking.transactions
```

When configured, `POST /transactions` publishes a message:

```json
{
  "transactionId": "TXN_xyz789",
  "fromAccount":   "ACC001",
  "toAccount":     "ACC002",
  "amount":        1500.00,
  "currency":      "USD",
  "reference":     "INV-2026-0614",
  "submittedAt":   "2026-06-14T08:00:00.000Z"
}
```

A Kafka consumer (separate service) reads this, processes the debit/credit, and updates the transaction status in MongoDB.

When `KAFKA_BROKERS` is unset, the service simulates a 2–5 second async processing delay and auto-settles the transaction — full demo flow without Kafka running.

---

## Error responses

| Scenario | Status | message |
|---|---|---|
| Account not found | 404 | `Account 'ACC001' not found` |
| Insufficient role | 403 | `Role 'viewer' cannot access this resource` |
| Negative amount | 400 | `amount must be a positive number` |
| Duplicate idempotencyKey | 200 | Returns original transaction (not an error) |
| Insufficient balance | 422 | `Insufficient funds in account ACC001` |

---

## Default users

| username | role | Access |
|---|---|---|
| `bank_admin` | admin | All endpoints — full account and transaction access |
| `teller` | manager | Submit transactions, view accounts |
| `auditor` | viewer | View transaction status only — no submit, no account list |

---

## Files

| File | What it does |
|---|---|
| `app.js` | Router + `meta` export. `meta.active = false` to disable. |
| `banking.routes.js` | Route definitions — `requireRole` on account and transaction list |
| `banking.controller.js` | Request parsing + idempotency check + response |
| `banking.service.js` | Account lookups, transaction submit (Kafka or stub), status polling |
