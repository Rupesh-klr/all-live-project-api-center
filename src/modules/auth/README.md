# Module: auth

> Express · JWT · bcryptjs · MongoDB

Shared authentication for all portfolio modules. One account works across every module. Issues JWT access + refresh token pairs backed by an active-token collection in MongoDB — every token is revocable instantly, with no wait for JWT expiry.

---

## Endpoints

Base path: `/api/auth/v1/`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | Public | Authenticate. Returns `accessToken` + `refreshToken` + user object. |
| `POST` | `/register` | Public | Create a new user account. |
| `POST` | `/refresh` | Public | Rotate both tokens. Old pair is revoked immediately. |
| `POST` | `/logout` | Bearer | Marks the current access token inactive. Instant — no expiry wait. |
| `GET`  | `/me` | Bearer | Returns `req.user` (userId, username, role, moduleAccess). |

---

## Login

```http
POST /api/auth/v1/login
Content-Type: application/json

{
  "identifier": "john_doe",
  "password": "ENCRY_MIDDLE_PROTECTION:U2FsdGVkX1+..."
}
```

`identifier` resolves in this order (single `$or` query):

```js
User.findOne({
  $or: [
    { username: identifier.toLowerCase() },
    { email:    identifier.toLowerCase() },
    { phoneNumber: identifier },
  ],
  isActive: true,
}).select('+passwordHash')
```

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "_id":          "64abc123...",
      "username":     "john_doe",
      "email":        "john@example.com",
      "role":         "admin",
      "moduleAccess": [],
      "displayName":  "John Doe",
      "lastLogin":    "2026-06-14T08:00:00.000Z"
    }
  }
}
```

`moduleAccess: []` means all modules. A non-empty array restricts to only those named modules.

**Error responses:**

| Scenario | Status | message |
|---|---|---|
| Wrong credentials | 401 | `Invalid credentials` |
| User inactive | 401 | `Invalid credentials` (same message — no user enumeration) |
| Rate limit hit | 429 | `Too many requests` |

---

## Register

```http
POST /api/auth/v1/register
Content-Type: application/json

{
  "username":    "john_doe",
  "email":       "john@example.com",
  "phoneNumber": "+919876543210",
  "password":    "ENCRY_MIDDLE_PROTECTION:U2FsdGVkX1+...",
  "displayName": "John Doe",
  "role":        "viewer"
}
```

`password` is stored via the pre-save hook:

```js
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  const salt = await bcrypt.genSalt(12)
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  next()
})
```

The controller assigns `passwordHash = data.password` (the already-decrypted plaintext), then `User.create()` triggers the hook. Raw password is never persisted.

**Conflict response (409):**

```json
{ "success": false, "message": "Username or email already taken" }
```

---

## Refresh

```http
POST /api/auth/v1/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

What happens internally:

```
1. jwt.verify(refreshToken, JWT_REFRESH_SECRET)   ← signature + expiry
2. Token.findOne({ refreshToken, isActive: true }) ← revocation check
3. User.findById(decoded.userId)                   ← user still active?
4. record.isActive = false; record.save()          ← revoke old pair
5. Token.create({ ...newPair, isActive: true })    ← issue new pair
6. Return { accessToken, refreshToken }
```

**Old token is dead the moment `refresh` succeeds.** If a stolen refresh token is replayed, step 2 will fail because the record was already set to `isActive: false`.

---

## Logout

```http
POST /api/auth/v1/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

```js
// auth.service.js
async function logout(accessToken) {
  await Token.findOneAndUpdate({ accessToken }, { isActive: false })
}
```

The token is immediately unusable on any protected endpoint. No wait for JWT expiry.

---

## Token lifecycle in MongoDB

```
Login
  Token {
    userId, accessToken, refreshToken,
    isActive: true,
    ipAddress, userAgent,
    accessExpiresAt,    ← now + JWT_ACCESS_EXPIRY
    refreshExpiresAt,   ← now + JWT_REFRESH_EXPIRY
  }

Auth middleware on every request
  Token.findOne({ accessToken, isActive: true })
  → not found = 401 (expired OR revoked)

Refresh
  Old record → isActive: false
  New record → isActive: true (new pair)

Logout
  Record → isActive: false

TTL auto-cleanup
  MongoDB TTL index on refreshExpiresAt + 86400s
  → Documents auto-delete ~1 day after refresh token expires
```

---

## JWT Payload

Access token payload (decoded):

```json
{
  "userId":       "64abc123...",
  "username":     "john_doe",
  "role":         "admin",
  "moduleAccess": ["telecom-optimizer", "banking-core"],
  "iat": 1718352000,
  "exp": 1718352900
}
```

Refresh token payload (minimal — only used to look up the user on rotate):

```json
{
  "userId": "64abc123...",
  "iat": 1718352000,
  "exp": 1720944000
}
```

---

## User Model

```js
// src/models/User.model.js

{
  username:     String  — unique, lowercase, trim
  email:        String  — unique, lowercase, trim
  phoneNumber:  String  — unique (sparse), trim
  passwordHash: String  — select: false — never returned by default
  role:         enum ['admin', 'manager', 'viewer', 'guest']  — default: 'viewer'
  moduleAccess: [String] — empty = all modules
  isActive:     Boolean — default: true
  lastLogin:    Date
  displayName:  String
  avatarUrl:    String
}
```

`toJSON` transform always deletes `passwordHash` from serialised output, even if someone accidentally uses `.select('+passwordHash')` in a query chain.

---

## Default seed users

These users must be created manually (no auto-seed). Use `POST /api/auth/v1/register` or a DB seed script.

| username | role | Purpose |
|---|---|---|
| `admin` | admin | Full access to all modules |
| `viewer` | viewer | Read-only, no restricted endpoints |

---

## Files

| File | What it does |
|---|---|
| `app.js` | Router export + `meta` (name, description, active flag, defaultUsers) |
| `auth.routes.js` | Route definitions — applies `authLimiter` (20 req / 15 min) to all auth routes |
| `auth.controller.js` | Parses req, calls service, formats HTTP response |
| `auth.service.js` | `findUserByIdentifier` / `signTokens` / `login` / `refreshAccess` / `logout` / `register` |
