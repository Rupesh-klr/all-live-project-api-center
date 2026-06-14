# Common Module Pattern — Backend

This doc explains how the backend loads and shares code across all modules,
and how a new developer (or you, in 6 months) can add a new module without
touching the core server setup.

---

## How the module loader works

```
src/
├── server.js            ← entry point — starts Express, loads modules
├── config/
│   └── db.js            ← MongoDB connection with diagnostics
├── middleware/
│   ├── auth.js          ← JWT verify + user attach to req.user
│   ├── decryptBody.js   ← AES-256 decrypt before controllers run
│   └── rateLimiter.js   ← per-route rate limiting
└── modules/
    ├── auth/            ← login, register, guest, logout, refresh
    │   └── app.js
    ├── telecom-optimizer/
    │   └── app.js
    ├── vectorshift/
    │   └── app.js
    ├── banking-core/
    │   └── app.js
    └── whatsapp-crm/
        └── app.js
```

`moduleLoader.js` scans every `src/modules/*/app.js` at startup and mounts each one
only if `module.exports.meta.active === true`. Zero config required — just set active.

```js
// src/moduleLoader.js  (simplified)
const dirs = fs.readdirSync(MODULES_DIR)
for (const dir of dirs) {
  const mod = require(path.join(MODULES_DIR, dir, 'app.js'))
  if (mod.meta?.active !== true) continue           // skip disabled modules
  app.use(`/api/${dir}/v1`, mod.router)
  console.log(`[modules] Loaded: ${dir}`)
}
```

---

## What every `app.js` must export

```js
// src/modules/your-module/app.js

const express = require('express')
const router  = express.Router()
const { authenticate } = require('../../middleware/auth')

// ── meta: consumed by module loader + /api/modules endpoint ──────────────────
module.exports.meta = {
  active:       true,          // false = skip entirely at startup
  name:         'Your Module Name',
  description:  'One-sentence summary shown in login banner and onboarding',
  version:      '1.0.0',
  tech:         ['Node.js', 'MongoDB'],       // shown in frontend onboarding
  highlights:   ['Key feature 1', 'Key feature 2'],
  defaultUsers: [
    { username: 'admin@gmail.com',      role: 'admin'  },
    { username: 'viewer@portfolio.hub', role: 'viewer' },
  ],
}

// ── routes ────────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ ok: true }))

router.get('/data', authenticate, async (req, res) => {
  // req.user is populated by authenticate middleware
  res.json({ data: [] })
})

module.exports.router = router
```

---

## Shared middleware

### `authenticate` — protect any route

```js
const { authenticate } = require('../../middleware/auth')

router.get('/protected', authenticate, (req, res) => {
  // req.user = { _id, username, email, role, moduleAccess }
  res.json({ user: req.user })
})
```

**What it does:**
1. Reads `Authorization: Bearer <token>` header
2. Verifies JWT signature with `JWT_SECRET`
3. Checks `Token` collection — rejects if `isActive: false` (logged out tokens)
4. Attaches decoded payload to `req.user`

### `decryptBody` — AES-256 body decryption

Applied globally in `server.js` before any route. The frontend encrypts all request
bodies with `ENCRY_MIDDLE_PROTECTION` key. You do **not** need to decrypt in controllers
— the body arrives already decrypted.

### `authLimiter` — rate limiting

```js
const { authLimiter } = require('../../middleware/rateLimiter')
router.post('/login', authLimiter, ctrl.login)
// 5 attempts per 15 min per IP for auth routes
```

---

## The `/api/modules` endpoint

Returns all active modules. The frontend login page banner and `OnboardingModal.jsx`
both read from this endpoint.

```
GET /api/modules
Response:
{
  "data": {
    "modules": [
      {
        "name": "Telecom Network Optimizer",
        "description": "...",
        "tech": ["Python", "Node.js"],
        "defaultUsers": [...]
      }
    ]
  }
}
```

This endpoint is auto-built from every module's `meta` object — no manual registration.

---

## Auth module — what it provides to all other modules

```
POST /api/auth/v1/login        → { accessToken, refreshToken, user }
POST /api/auth/v1/register     → { accessToken, refreshToken, user }  (auto-login)
POST /api/auth/v1/guest        → { accessToken, refreshToken, user, expiresAt }
POST /api/auth/v1/logout       → revokes token immediately
POST /api/auth/v1/refresh      → exchange refreshToken for new accessToken
```

**One login, all modules** — the `moduleAccess` field on the user document controls
which modules the user can use. An empty array means access to all modules.

---

## Guest users

- Role: `guest`
- Auto-deleted: MongoDB TTL index on `expiresAt` field (7 days)
- `expiresAt: null` on regular users → TTL never fires

```js
// User.model.js
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Documents where expiresAt <= now() are deleted automatically by MongoDB
// Documents where expiresAt === null are ignored by TTL
```

---

## Security layers (applied in order per request)

```
Request arrives
  │
  ▼
1. decryptBody middleware    — AES-256 body decrypt
  │
  ▼
2. rateLimiter              — IP-based rate limit
  │
  ▼
3. authenticate middleware   — JWT verify + token active check
  │
  ▼
4. Your controller          — req.user is ready, body is decrypted
  │
  ▼
5. Response                 — passwordHash always stripped via toJSON()
```

---

## Adding a new module — backend steps only

```
1. Create src/modules/your-module/
   ├── app.js            ← router + meta (see template above)
   ├── your.service.js   ← business logic
   ├── your.controller.js← thin HTTP handler
   └── Your.model.js     ← Mongoose schema (optional)

2. Set meta.active = true

3. Restart the server — module loader picks it up at src/modules/your-module/app.js

Routes are available at: /api/your-module/v1/<path>
No changes to server.js, no registration required.
```

---

## Environment variables every module can read

```env
MONGO_URI          # MongoDB connection string
JWT_SECRET         # JWT signing key (HS256)
JWT_REFRESH_SECRET # Refresh token signing key
ENCRY_MIDDLE_PROTECTION  # AES-256 key for body encryption
PORT               # Server port (default 4000)
NODE_ENV           # development | production
LOG_KEY            # 24-char key for log viewer endpoint
```

All read via `process.env.*` — never hardcode.

---

## Winston log viewer

Protected endpoint: `GET /api/logs?tail=50` with header `X-Log-Key: <LOG_KEY>`

Logs are daily-rotated files in `logs/`. Each log entry has:
```json
{ "level": "info", "message": "...", "timestamp": "...", "module": "auth" }
```

To log from a module:
```js
const logger = require('../../config/logger')
logger.info('Payment processed', { userId: req.user._id, amount: 500 })
logger.error('DB write failed', { err: err.message })
```
