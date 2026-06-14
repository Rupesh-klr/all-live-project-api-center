# Security Model — all-live-project-api-center

## Password Encryption (ENCRY_MIDDLE_PROTECTION protocol)

Passwords and other sensitive fields are AES-encrypted on the frontend before being sent, using a shared passphrase stored in environment variables on both sides.

**Flow:**

```
Frontend (browser)
  1. User types password: "mySecret123"
  2. CryptoJS.AES.encrypt("mySecret123", VITE_ENCRY_MIDDLE_KEY)
  3. Prepend prefix → "ENCRY_MIDDLE_PROTECTION:U2FsdGVkX1+..."
  4. Send via HTTPS in request body

Backend (encryptionMiddleware)
  1. Sees body.password starts with "ENCRY_MIDDLE_PROTECTION:"
  2. Strips prefix → "U2FsdGVkX1+..."
  3. CryptoJS.AES.decrypt(ciphertext, ENCRY_MIDDLE_KEY) → "mySecret123"
  4. Replaces body.password = "mySecret123"
  5. Controller receives plain password, bcrypt.compare runs normally
```

**Rules:**
- `ENCRY_MIDDLE_KEY` must be **identical** in both `.env` (backend) and `.env` (frontend `VITE_ENCRY_MIDDLE_KEY`)
- The prefix check is pattern-based — any field in body or query can be encrypted, not just password
- If decryption fails → 400 Bad Request (attacker cannot probe by trying raw values)

---

## Password Storage

- `bcryptjs` with `saltRounds = 12`
- Hash stored in `user.passwordHash` — field has `select: false` (never returned in queries by default)
- `toJSON()` transform deletes `passwordHash` from all serialized output
- Developers **cannot** read passwords from DB — bcrypt is one-way

---

## Token System

```
Login success
  → Generate JWT access token  (expires: JWT_ACCESS_EXPIRY, e.g. 15m)
  → Generate JWT refresh token (expires: JWT_REFRESH_EXPIRY, e.g. 30d)
  → Save both to Token collection { userId, accessToken, refreshToken, isActive:true }

Every protected API request
  → Extract Bearer token
  → jwt.verify(token, JWT_ACCESS_SECRET)     ← cryptographic check
  → Token.findOne({ accessToken, isActive:true })  ← DB revocation check
  → Both must pass — token stolen after logout is rejected

Refresh
  → jwt.verify(refreshToken, JWT_REFRESH_SECRET)
  → Find active Token record for this refreshToken
  → Revoke old record (isActive:false)
  → Create new access + refresh tokens
  → Frontend updates localStorage

Logout
  → Token.findOneAndUpdate({ accessToken }, { isActive:false })
  → Old token is dead immediately — no waiting for expiry
```

---

## Rate Limiting

| Scope | Window | Max requests |
|---|---|---|
| Global (all routes) | 15 min | 200 |
| Auth routes only | 15 min | 20 |

Exceeding limits → `429 Too Many Requests`.

---

## Bot Protection

Blocks at request entry before any DB or business logic:

1. **No User-Agent** → 403
2. **Known bot UA patterns** → 403 (curl, wget, python-requests, go-http-client, java/, scrapers, crawlers, etc.)
3. **Honeypot path** `/api/verify-human-token-hidden` → any request here = bot confirmed → 403

---

## CORS

- Explicit origin list: `CORS_ALLOWED_ORIGINS` (comma-separated)
- Auto-allows all subdomains of `CORS_MAIN_DOMAIN` (e.g. `*.myagemap.com`)
- Non-matching origins → CORS error before any logic runs

---

## IP / Host Whitelist (optional)

- `WHITELIST_IPS` — comma-separated IP list
- `WHITELIST_HOSTS` — comma-separated host:port list
- If both are empty → no IP restriction (allow all)
- Used for internal/staging environments where you want to restrict access to known IPs only

---

## Log Security

- Logs written to files only — never contain passwords, raw tokens, or S3 keys
- Log viewer endpoint requires `X-Log-Key` header — a 24-character key from env not exposed to the frontend
- Log files rotate daily, retained 30 days, then auto-deleted
