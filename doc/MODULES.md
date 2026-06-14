# Module Reference — all-live-project-api-center

## How modules work

The server auto-discovers every directory under `src/modules/` that contains an `app.js`.  
If `meta.active !== true` → **skipped entirely** (not mounted, not listed in Swagger, not visible).

---

## auth — `/api/auth/v1/`

Shared authentication used by all other modules. Every module's protected routes use the token issued here.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | Public | Login with `identifier` (username/email/phone) + `password`. Returns `accessToken` + `refreshToken`. |
| POST | `/register` | Public | Create a new user. `password` accepted as plain or `ENCRY_MIDDLE_PROTECTION:` encrypted. |
| POST | `/refresh` | Public | Exchange valid refresh token for new access + refresh token pair. Old pair is revoked. |
| POST | `/logout` | Bearer | Marks the current access token as inactive in DB. |
| GET  | `/me` | Bearer | Returns current `req.user` payload. |

**Default users (seed manually):**

| Username | Role | Access |
|---|---|---|
| `admin` | admin | All modules |
| `viewer` | viewer | Read-only |

---

## telecom-optimizer — `/api/telecom-optimizer/v1/`

Graph Theory network routing. Python service bridge-ready.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/info` | Public | Module meta and highlights |
| GET  | `/nodes` | Bearer | List all dynamic network nodes |
| POST | `/graph/shortest-path` | Bearer | Run Dijkstra/A* — connect to Python microservice |

**Default users:** `network_admin` (admin), `analyst` (viewer)

---

## vectorshift — `/api/vectorshift/v1/`

RAG Pipeline Builder — FastAPI + vector DB bridge-ready.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/info` | Public | Module meta |
| GET  | `/pipelines` | Bearer | List all RAG pipelines |
| POST | `/pipelines` | admin/manager | Create pipeline (DAG definition) |
| POST | `/pipelines/:id/run` | Bearer | Execute a pipeline query |

**Default users:** `ml_engineer` (admin), `data_analyst` (viewer)

---

## banking-core — `/api/banking-core/v1/`

Distributed banking — Kafka bridge-ready.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/info` | Public | Module meta |
| GET  | `/accounts` | admin/manager | List accounts |
| POST | `/transactions` | Bearer | Submit transaction (Kafka-backed) |
| GET  | `/transactions/:id/status` | Bearer | Transaction status |

**Default users:** `bank_admin` (admin), `teller` (manager), `auditor` (viewer)

---

## whatsapp-crm — `/api/whatsapp-crm/v1/`

WhatsApp CRM — webhook + contact management.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/info` | Public | Module meta |
| POST | `/webhook` | Public | WhatsApp Business API incoming webhook |
| GET  | `/contacts` | Bearer | List CRM contacts |
| POST | `/messages/send` | admin/manager | Send WhatsApp message |
| GET  | `/workflows` | Bearer | List automation workflows |

**Default users:** `crm_admin` (admin), `agent` (manager), `support` (viewer)

---

## Adding a new module

1. Create `src/modules/<your-module>/app.js`
2. Export `{ router, meta }` with `meta.active = true`
3. Restart server — it auto-mounts at `/api/<your-module>/v1/`
4. Add `@swagger` JSDoc to your routes — Swagger UI auto-picks them up

## Removing a module

- **Soft remove:** Set `meta.active = false` in `app.js` → restart. Server ignores it.
- **Hard remove:** Delete the module folder entirely → restart. Nothing changes on other modules.
