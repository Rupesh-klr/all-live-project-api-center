# ⚙️ Portfolio Hub — API Center

[![Live API](https://img.shields.io/badge/Live_API-online-22c55e?style=for-the-badge&logo=node.js&logoColor=white)](https://all-live-project-api-center-rupesh-klr.holistichealervedika.com)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](#)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](#)

> **🔗 Live API:** **https://all-live-project-api-center-rupesh-klr.holistichealervedika.com**
> **🖥️ Frontend:** https://all-live-project-rupesh-klr.holistichealervedika.com/
> Node.js · Express · MongoDB · JWT · AES-256 · Winston · Swagger

**A production-architecture backend** powering the Portfolio Hub. One server, one auth layer,
pluggable modules — each module is a self-contained folder you can delete to remove or create
to add, with **zero changes to `server.js`**.

> 💡 **Probe it live:** `GET /health` and `GET /api/modules` are public — try
> `https://all-live-project-api-center-rupesh-klr.holistichealervedika.com/api/modules`.

### Why this stands out
- **Dynamic module loading** — server scans `src/modules/` at startup and mounts only modules where `meta.active === true`.
- **Real algorithms, not wrappers** — Dijkstra/A* + Yen’s k-shortest-paths, keyword-overlap RAG with scored retrieval, async idempotent settlement, cross-currency FX.
- **Layered security** — bot protection, rate limiting, CORS subdomain matching, IP/host whitelist, Helmet, AES-in-transit + bcrypt-at-rest, active token revocation.
- **Self-documenting** — Swagger UI auto-generated from JSDoc across every module.

---

Centralized backend for all portfolio modules. One server, one auth layer, pluggable modules. Each module is a self-contained folder — delete it to remove it, create it to add it. Zero changes to `server.js` required.

---

## What this is

This is not a starter template. It is a production-architecture backend that demonstrates:

- **Dynamic module loading** — server scans `src/modules/` at startup; only mounts modules where `meta.active === true`
- **Active token revocation** — every JWT is tracked in MongoDB; logout is instant, no waiting for expiry
- **End-to-end password encryption** — AES-256 on the frontend, decrypted by middleware before controllers run; bcrypt-12 in storage
- **Layered security middleware** — bot protection, rate limiting, CORS subdomain matching, IP/host whitelist, Helmet headers — all before a single line of business logic
- **24-char log viewer** — tail and paginate live logs from any HTTP client, key-gated

---

## Requirements

| Tool | Min version |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| MongoDB | 6.x (local or Atlas) |

---

## Setup

```bash
git clone <repo>
cd all-live-project-api-center

npm install

cp .env.example .env
# edit .env — see Environment Variables section below

npm run dev        # nodemon, restarts on file change
# or
npm start          # production start
```

Server starts at `http://localhost:5000`
Swagger UI at `http://localhost:5000/api-docs`
Health check at `http://localhost:5000/health`

---

## Environment Variables

Every variable in `.env.example` is required unless marked optional.

```env
# ── Server ─────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── MongoDB ────────────────────────────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/portfolio_hub
# Atlas example: mongodb+srv://user:pass@cluster.mongodb.net/portfolio_hub

# ── JWT ────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=change_me_access_secret_min_32_chars
JWT_REFRESH_SECRET=change_me_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRY=15m      # s / m / h / d
JWT_REFRESH_EXPIRY=30d

# ── Encryption (MUST match VITE_ENCRY_MIDDLE_KEY in frontend .env) ─────
ENCRY_MIDDLE_KEY=change_me_32char_aes_passphrase!!

# ── Log viewer ──────────────────────────────────────────────────────────
LOG_ACCESS_KEY=change_me_24charLogAccessKey!!   # exactly 24 chars recommended

# ── CORS ────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_MAIN_DOMAIN=yourdomain.com    # all *.yourdomain.com subdomains are allowed

# ── IP / Host whitelist (leave empty to allow all) ──────────────────────
WHITELIST_IPS=
WHITELIST_HOSTS=

# ── Rate limiting ───────────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000    # 15 min in milliseconds
RATE_LIMIT_MAX=200
```

---

## Project Layout

```
all-live-project-api-center/
├── server.js                          ← Entry point
├── .env.example
├── package.json
├── logs/                              ← Winston daily-rotate log files
├── doc/
│   ├── ARCHITECTURE.md
│   ├── MODULES.md
│   └── SECURITY.md
└── src/
    ├── config/
    │   ├── db.js                      ← Mongoose connect / events
    │   ├── moduleLoader.js            ← Dynamic module scanner + mounter
    │   └── swagger.js                 ← Auto-Swagger from JSDoc across all modules
    ├── middleware/
    │   ├── auth.middleware.js         ← JWT verify + Token collection revocation check
    │   ├── encryption.middleware.js   ← Decrypt ENCRY_MIDDLE_PROTECTION: fields
    │   ├── cors.middleware.js         ← Origin list + *.mainDomain
    │   ├── rateLimiter.middleware.js  ← express-rate-limit global + auth
    │   ├── accessControl.middleware.js← IP / host whitelist
    │   └── botProtection.middleware.js← UA block + honeypot
    ├── models/
    │   ├── User.model.js              ← username / email / phone / bcrypt hash / role
    │   └── Token.model.js             ← Per-login token pair, isActive flag, TTL index
    ├── modules/
    │   ├── auth/                      ← Login · Register · Refresh · Logout · /me
    │   ├── telecom-optimizer/         ← Network routing — Python bridge ready
    │   ├── vectorshift/               ← RAG pipelines — FastAPI bridge ready
    │   ├── banking-core/              ← Transactions — Kafka bridge ready
    │   └── whatsapp-crm/             ← WhatsApp Business API + webhooks
    ├── routes/
    │   ├── modules.routes.js          ← GET /api/modules — active module list
    │   └── logs.routes.js             ← GET /api/logs/files · /api/logs/view
    └── utils/
        ├── encryption.js              ← AES decrypt + PREFIX constants
        ├── logger.js                  ← Winston (console + file rotate)
        └── response.js                ← ok() / badRequest() / unauthorized() helpers
```

---

## Request Pipeline

Every request passes through this stack before hitting any controller:

```
Client request
  │
  ├─ Helmet            ← Security headers (CSP, X-Frame-Options, HSTS …)
  ├─ CORS              ← Origin check: explicit list OR *.CORS_MAIN_DOMAIN
  ├─ Rate limiter      ← 200 req / 15 min global (20 req / 15 min on /auth)
  ├─ Access control    ← IP / host whitelist (no-op when env vars empty)
  ├─ Bot protection    ← UA pattern block + no-UA block + honeypot /api/verify-human-token-hidden
  ├─ Body parse        ← JSON (10 MB limit)
  ├─ encryptionMiddleware  ← Decrypt any ENCRY_MIDDLE_PROTECTION: field in body/query
  │
  ├─ /health           ← { status, env, ts } — always public
  ├─ /api/modules      ← Active module list (login-page banner)
  ├─ /api/logs/*       ← X-Log-Key gated log viewer
  ├─ /api/<module>/v1/ ← Dynamically loaded active modules
  │     └─ authMiddleware (on protected routes)
  │           ├─ jwt.verify(token, JWT_ACCESS_SECRET)
  │           └─ Token.findOne({ accessToken, isActive: true })
  │
  ├─ 404 handler       ← logs warn + returns { success: false }
  └─ Global error handler
```

---

## Module System

### How a module is loaded

```js
// src/config/moduleLoader.js — simplified

const entries = fs.readdirSync('src/modules/', { withFileTypes: true })
for (const entry of entries) {
  const mod = require(`src/modules/${entry.name}/app.js`)
  if (!mod.meta?.active) { logger.info('skipped'); continue }
  app.use(`/api/${entry.name}/v1`, mod.router)   // ← mounted here
}
```

### Module contract — every `app.js` must export this shape

```js
const { Router } = require('express')
const router = Router()

// Your routes here
router.get('/info', (req, res) => res.json({ ...meta }))

const meta = {
  name: 'my-module',            // must match the folder name
  version: 'v1',
  description: 'One-line summary shown in the frontend login-page banner',
  active: true,                 // false = server never loads this module
  tech: ['Node.js', 'MongoDB'],
  highlights: ['Key feature 1', 'Key feature 2'],
  defaultUsers: [
    { username: 'mod_admin', role: 'admin',  description: 'Full access' },
    { username: 'viewer',    role: 'viewer', description: 'Read only' },
  ],
}

module.exports = { router, meta }
```

### Add a module

1. `mkdir src/modules/my-new-module`
2. Create `app.js` following the contract above
3. `npm run dev` — server restarts, mounts `/api/my-new-module/v1/`

### Remove a module

- **Soft:** Set `meta.active = false` → restart. Server ignores it.
- **Hard:** Delete the folder → restart. No other files change.

---

## Authentication

All protected routes use `authMiddleware` from `src/middleware/auth.middleware.js`.

```js
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')

router.get('/dashboard', authMiddleware, controller.getDashboard)
router.delete('/user/:id', authMiddleware, requireRole('admin'), controller.deleteUser)
```

`requireRole` accepts a string or array:

```js
requireRole('admin')                    // only admin
requireRole(['admin', 'manager'])       // admin or manager
```

After `authMiddleware` runs, `req.user` is:

```js
{
  userId:       '64abc...',
  username:     'john_doe',
  role:         'admin',
  moduleAccess: ['telecom-optimizer', 'banking-core'],   // empty = all modules
}
```

---

## Password Security

Passwords never travel in plaintext:

```
Frontend (Login.jsx)
  encryptPassword(password)
    → CryptoJS.AES.encrypt(password, VITE_ENCRY_MIDDLE_KEY)
    → "ENCRY_MIDDLE_PROTECTION:U2FsdGVkX1+..."

HTTP POST /api/auth/v1/login
  { identifier: "john", password: "ENCRY_MIDDLE_PROTECTION:U2FsdGVkX1+..." }

encryptionMiddleware (runs before every controller)
  → sees prefix → strips → decrypts → req.body.password = "mySecret123"

auth.service.js → login()
  → user.comparePassword("mySecret123")   ← bcrypt.compare against stored hash
```

Storage: `bcryptjs` with `saltRounds = 12`. Field `passwordHash` has `select: false` — never returned from any query by default. `toJSON()` also deletes it from all serialised output.

---

## Log Viewer

Server writes to `logs/app-YYYY-MM-DD.log` (Winston daily rotate). Access is key-gated — the `LOG_ACCESS_KEY` env variable is never sent to the frontend.

```bash
# List log files
curl -H "X-Log-Key: YOUR_LOG_ACCESS_KEY" http://localhost:5000/api/logs/files

# Tail the last 50 lines (like tail -n 50)
curl -H "X-Log-Key: YOUR_LOG_ACCESS_KEY" \
  "http://localhost:5000/api/logs/view?file=app-2026-06-14.log&tail=true&limit=50"

# Page 3, 100 lines per page
curl -H "X-Log-Key: YOUR_LOG_ACCESS_KEY" \
  "http://localhost:5000/api/logs/view?file=app-2026-06-14.log&page=3&limit=100"
```

Tail mode max: 500 lines per request. Page mode max: 500 lines per page.

---

## Swagger

Swagger UI is auto-generated from `@swagger` JSDoc in route files. Available at:

```
http://localhost:5000/api-docs
```

Each module's routes are picked up automatically — no manual registration. To document an endpoint, add a JSDoc block above the route:

```js
/**
 * @swagger
 * /api/my-module/v1/items:
 *   get:
 *     tags: [MyModule]
 *     summary: List all items
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/items', authMiddleware, controller.list)
```

---

## Available Scripts

```bash
npm run dev       # nodemon dev server — restarts on file change
npm start         # production start (no watch)
```

---

## Modules Reference

| Module | Mount | README |
|---|---|---|
| auth | `/api/auth/v1/` | [src/modules/auth/README.md](src/modules/auth/README.md) |
| telecom-optimizer | `/api/telecom-optimizer/v1/` | [src/modules/telecom-optimizer/README.md](src/modules/telecom-optimizer/README.md) |
| vectorshift | `/api/vectorshift/v1/` | [src/modules/vectorshift/README.md](src/modules/vectorshift/README.md) |
| banking-core | `/api/banking-core/v1/` | [src/modules/banking-core/README.md](src/modules/banking-core/README.md) |
| whatsapp-crm | `/api/whatsapp-crm/v1/` | [src/modules/whatsapp-crm/README.md](src/modules/whatsapp-crm/README.md) |

---

## Further Reading

- [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md) — Full request lifecycle, module contract, password security diagram
- [doc/MODULES.md](doc/MODULES.md) — Per-module endpoint reference, default users, add/remove guide
- [doc/SECURITY.md](doc/SECURITY.md) — All security layers, token lifecycle, bot protection, CORS
