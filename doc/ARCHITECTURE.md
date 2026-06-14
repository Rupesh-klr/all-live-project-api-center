# Backend Architecture — all-live-project-api-center

## What Was Created

### Entry Point

| File | What it does |
|---|---|
| `server.js` | Entry point — mounts all middleware in order, then dynamically loads active modules, then starts listening |

---

### src/config/

| File | What it does |
|---|---|
| `db.js` | MongoDB connection via Mongoose — logs connect/disconnect/error events |
| `moduleLoader.js` | Scans `src/modules/*/app.js` at startup — skips any module where `meta.active !== true`, mounts active ones at `/api/<name>/v1/` |
| `swagger.js` | Auto-collects JSDoc `@swagger` annotations from all module files, serves unified Swagger UI at `/api-docs` |

---

### src/middleware/

| File | What it does |
|---|---|
| `auth.middleware.js` | Extracts Bearer token → `jwt.verify` → checks `Token` collection for `isActive:true` → attaches `req.user`; also exports `requireRole(roles)` factory |
| `encryption.middleware.js` | Runs on every request — recursively scans `req.body` and `req.query` for fields starting with `ENCRY_MIDDLE_PROTECTION:`, decrypts them with AES (CryptoJS), replaces value in-place before controller sees it |
| `cors.middleware.js` | Allows explicitly listed origins + any subdomain of `CORS_MAIN_DOMAIN` (e.g. `*.myagemap.com`) |
| `rateLimiter.middleware.js` | Global: 200 req/15 min; `authLimiter`: 20 req/15 min (applied only on auth routes) |
| `accessControl.middleware.js` | Optional IP/host whitelist — no-op when env vars are empty |
| `botProtection.middleware.js` | Blocks known bot User-Agent patterns, no-UA requests, and a hidden honeypot endpoint |

---

### src/models/

| File | What it does |
|---|---|
| `User.model.js` | Stores `username`, `email`, `phoneNumber`, `passwordHash` (bcrypt 12 rounds), `role`, `moduleAccess`, `isActive`. Password is **never** stored raw. `comparePassword()` instance method runs bcrypt compare. `toJSON` removes `passwordHash` from all output. |
| `Token.model.js` | Tracks every `accessToken` + `refreshToken` pair per user. `isActive:false` = revoked. Auth middleware checks this on every request. TTL index auto-deletes records 1 day after refresh expiry. |

---

### src/modules/

Each module is a self-contained folder. The server **only** loads modules where `app.js` exists **and** `meta.active === true`.

| Module | Mount path | What it does |
|---|---|---|
| `auth/` | `/api/auth/v1/` | Login, register, refresh token, logout, `/me` |
| `telecom-optimizer/` | `/api/telecom-optimizer/v1/` | Network node list, shortest-path endpoint (Python bridge ready) |
| `vectorshift/` | `/api/vectorshift/v1/` | RAG pipeline CRUD + run endpoint (FastAPI bridge ready) |
| `banking-core/` | `/api/banking-core/v1/` | Account list (admin/manager), transaction submit + status (Kafka bridge ready) |
| `whatsapp-crm/` | `/api/whatsapp-crm/v1/` | WhatsApp webhook, contact list, message send, workflow list |

**To deactivate a module:** set `meta.active = false` in its `app.js` — the server will skip it on next restart.  
**To add a new module:** create `src/modules/<name>/app.js` exporting `{ router, meta }` with `meta.active = true`.

---

### src/routes/ (system routes)

| File | What it does |
|---|---|
| `modules.routes.js` | `GET /api/modules` — returns all active module meta (used by frontend login-page banner) |
| `logs.routes.js` | `GET /api/logs/files` + `GET /api/logs/view` — protected by `X-Log-Key` header (24-char key from env); supports tail mode + pagination |

---

## Request Lifecycle

```
Client request
  → Helmet (security headers)
  → CORS check
  → Rate limiter
  → IP/host access control
  → Bot/UA check
  → Body parse (JSON)
  → encryptionMiddleware (decrypt ENCRY_MIDDLE_PROTECTION: fields)
  → Route handler
      → authMiddleware (if protected)
          → jwt.verify
          → Token.findOne({ accessToken, isActive:true })
          → req.user attached
      → controller
  → Response
```

---

## Module app.js contract

```js
const { Router } = require('express')
const router = Router()

router.get('/ping', (req, res) => res.json({ ok: true }))

const meta = {
  name: 'my-module',      // must match folder name
  version: 'v1',
  description: 'Short description shown in login-page banner',
  active: true,           // false = server never loads this module
  tech: ['Node.js'],
  highlights: ['Feature 1', 'Feature 2'],
  defaultUsers: [
    { username: 'mod_admin', role: 'admin', description: 'Module admin' },
    { username: 'viewer', role: 'viewer', description: 'Read-only' },
  ],
}

module.exports = { router, meta }
```

---

## Password Security Model

```
Frontend                               Backend
────────                               ───────
user types password
  ↓
CryptoJS.AES.encrypt(pw, KEY)
  ↓
"ENCRY_MIDDLE_PROTECTION:" + ciphertext
  ↓  (sent over HTTPS)
                                encryptionMiddleware decrypts → plaintext
                                  ↓
                                authService.login()
                                  ↓
                                bcrypt.compare(plaintext, user.passwordHash)
                                  ↓
                                passwordHash stored with bcrypt 12 rounds
                                NEVER raw, NEVER in logs
```

---

## Log Viewer Usage

```bash
# List log files
curl -H "X-Log-Key: YOUR_24_CHAR_KEY" http://localhost:5000/api/logs/files

# Tail last 100 lines (like tail -f)
curl -H "X-Log-Key: YOUR_24_CHAR_KEY" \
  "http://localhost:5000/api/logs/view?file=app-2026-06-14.log&tail=true&limit=100"

# Paginated (page 2, 50 lines per page)
curl -H "X-Log-Key: YOUR_24_CHAR_KEY" \
  "http://localhost:5000/api/logs/view?file=app-2026-06-14.log&page=2&limit=50"
```
