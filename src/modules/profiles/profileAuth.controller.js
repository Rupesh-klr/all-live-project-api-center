const ProfileUser = require('./profileUser.model')
const { signProfileToken } = require('./profileAuth.middleware')
const { ok, created, badRequest, conflict, unauthorized, notFound } = require('../../utils/response')
const logger = require('../../utils/logger')

// Dev verification OTP — we're out of SMS/email credits, so a fixed code is used.
const DEV_OTP = process.env.PROFILE_DEV_OTP || '123123'
const DEFAULT_RESET = process.env.PROFILE_DEFAULT_RESET || '123123'
const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/

/** POST /auth/signup — username + password, OTP-gated (dev OTP 123123). Email optional, dup-allowed. */
async function signup(req, res, next) {
  try {
    const username = String(req.body?.username || '').toLowerCase().trim()
    const password = String(req.body?.password || '')
    const otp = String(req.body?.otp || '')
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : ''
    const name = req.body?.name ? String(req.body.name) : ''

    if (!USERNAME_RE.test(username)) return badRequest(res, 'Username: 3–30 chars (a–z, 0–9, dot, dash, underscore)')
    if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters')
    if (otp !== DEV_OTP) return badRequest(res, `Invalid OTP. (Dev mode: the OTP is ${DEV_OTP})`)
    if (await ProfileUser.exists({ username })) return conflict(res, 'Username already taken')

    const user = await ProfileUser.create({ username, email, name, passwordHash: password })
    const token = signProfileToken(user)
    logger.info(`[profiles] account created: ${username}`)
    return created(res, { token, user: user.toJSON() }, 'Account created')
  } catch (err) {
    return next(err)
  }
}

/** POST /auth/login — by username + password. */
async function login(req, res, next) {
  try {
    const username = String(req.body?.username || '').toLowerCase().trim()
    const password = String(req.body?.password || '')
    const user = await ProfileUser.findOne({ username, isActive: true }).select('+passwordHash')
    if (!user || !(await user.comparePassword(password))) {
      return unauthorized(res, 'Invalid username or password')
    }
    const token = signProfileToken(user)
    return ok(res, { token, user: user.toJSON() }, 'Logged in')
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /auth/forgot — OTP-gated password reset (dev mode).
 * With the dev OTP, any user can reset their password; if no newPassword is
 * given it is set to the default (123123).
 */
async function forgot(req, res, next) {
  try {
    const username = String(req.body?.username || '').toLowerCase().trim()
    const otp = String(req.body?.otp || '')
    const newPassword = req.body?.newPassword ? String(req.body.newPassword) : DEFAULT_RESET
    if (otp !== DEV_OTP) return badRequest(res, `Invalid OTP. (Dev mode: the OTP is ${DEV_OTP})`)
    if (newPassword.length < 6) return badRequest(res, 'New password must be at least 6 characters')

    const user = await ProfileUser.findOne({ username }).select('+passwordHash')
    if (!user) return notFound(res, 'No account with that username')
    user.passwordHash = newPassword // pre-save hook hashes it
    await user.save()
    logger.info(`[profiles] password reset: ${username}`)
    return ok(res, { username, resetTo: newPassword === DEFAULT_RESET ? DEFAULT_RESET : undefined }, 'Password reset — you can now log in')
  } catch (err) {
    return next(err)
  }
}

/** GET /auth/me */
async function me(req, res, next) {
  try {
    const user = await ProfileUser.findById(req.user.userId)
    if (!user) return unauthorized(res, 'Account not found')
    return ok(res, { user: user.toJSON() }, 'Account')
  } catch (err) {
    return next(err)
  }
}

module.exports = { signup, login, forgot, me }
