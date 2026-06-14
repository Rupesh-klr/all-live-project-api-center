const authService = require('./auth.service')
const { ok, created, badRequest, serverError } = require('../../utils/response')
const logger = require('../../utils/logger')

/**
 * @swagger
 * /api/auth/v1/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with username/email/phone + password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: "username, email, or phone number" }
 *               password:   { type: string, description: "raw password or ENCRY_MIDDLE_PROTECTION:... prefixed" }
 *     responses:
 *       200: { description: Login success — returns accessToken + refreshToken + user }
 *       401: { description: Invalid credentials }
 */
async function login(req, res) {
  const { identifier, password } = req.body
  if (!identifier || !password) return badRequest(res, 'identifier and password are required')

  try {
    const result = await authService.login(identifier, password, {
      ip: req.ip,
      ua: req.headers['user-agent'],
    })
    return ok(res, result, 'Login successful')
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ success: false, message: err.message })
    logger.error('Login error', { error: err.message })
    return serverError(res)
  }
}

/**
 * @swagger
 * /api/auth/v1/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user — auto-logs in and returns tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:    { type: string }
 *               email:       { type: string }
 *               phoneNumber: { type: string }
 *               password:    { type: string, description: "raw or ENCRY_MIDDLE_PROTECTION: prefixed" }
 *               displayName: { type: string }
 *     responses:
 *       201: { description: Registered + auto-logged in — returns accessToken + refreshToken + user }
 *       409: { description: Username or email already taken }
 */
async function register(req, res) {
  const { username, email, phoneNumber, password, displayName } = req.body
  if (!username || !email || !password) {
    return badRequest(res, 'username, email, and password are required')
  }

  try {
    const result = await authService.register(
      { username, email, phoneNumber, password, displayName },
      { ip: req.ip, ua: req.headers['user-agent'] }
    )
    return created(res, result, 'Registration successful — you are now logged in')
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ success: false, message: err.message })
    logger.error('Register error', { error: err.message })
    return serverError(res)
  }
}

/**
 * @swagger
 * /api/auth/v1/guest:
 *   post:
 *     tags: [Auth]
 *     summary: Create a temporary guest session — account auto-deletes after 7 days
 *     responses:
 *       201: { description: Guest session created — returns accessToken + refreshToken + user + expiresAt }
 */
async function guest(req, res) {
  try {
    const result = await authService.guestRegister({
      ip: req.ip,
      ua: req.headers['user-agent'],
    })
    return created(res, result, 'Guest session created — expires in 7 days')
  } catch (err) {
    logger.error('Guest register error', { error: err.message })
    return serverError(res)
  }
}

/**
 * @swagger
 * /api/auth/v1/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 */
async function refresh(req, res) {
  const { refreshToken } = req.body
  if (!refreshToken) return badRequest(res, 'refreshToken is required')

  try {
    const tokens = await authService.refreshAccess(refreshToken)
    return ok(res, tokens, 'Token refreshed')
  } catch (err) {
    return res.status(err.status || 401).json({ success: false, message: err.message })
  }
}

/**
 * @swagger
 * /api/auth/v1/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke current token
 *     security: [{ bearerAuth: [] }]
 */
async function logout(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token) await authService.logout(token)
  return ok(res, null, 'Logged out successfully')
}

/**
 * @swagger
 * /api/auth/v1/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 */
function me(req, res) {
  return ok(res, { user: req.user }, 'Current user')
}

module.exports = { login, register, guest, refresh, logout, me }
