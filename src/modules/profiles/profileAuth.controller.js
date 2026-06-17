const ProfileUser = require('./profileUser.model')
const { signProfileToken } = require('./profileAuth.middleware')
const { ok, created, badRequest, conflict, unauthorized } = require('../../utils/response')
const logger = require('../../utils/logger')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST /auth/signup — create an isolated profile-builder account. */
async function signup(req, res, next) {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    const password = String(req.body?.password || '')
    const name = req.body?.name ? String(req.body.name) : ''
    if (!EMAIL_RE.test(email)) return badRequest(res, 'A valid email is required')
    if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters')
    if (await ProfileUser.exists({ email })) return conflict(res, 'An account with this email already exists')

    const user = await ProfileUser.create({ email, name, passwordHash: password })
    const token = signProfileToken(user)
    logger.info(`[profiles] account created: ${email}`)
    return created(res, { token, user: user.toJSON() }, 'Account created')
  } catch (err) {
    return next(err)
  }
}

/** POST /auth/login — authenticate a profile-builder account. */
async function login(req, res, next) {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim()
    const password = String(req.body?.password || '')
    const user = await ProfileUser.findOne({ email, isActive: true }).select('+passwordHash')
    if (!user || !(await user.comparePassword(password))) {
      return unauthorized(res, 'Invalid email or password')
    }
    const token = signProfileToken(user)
    return ok(res, { token, user: user.toJSON() }, 'Logged in')
  } catch (err) {
    return next(err)
  }
}

/** GET /auth/me — current profile-builder account. */
async function me(req, res, next) {
  try {
    const user = await ProfileUser.findById(req.user.userId)
    if (!user) return unauthorized(res, 'Account not found')
    return ok(res, { user: user.toJSON() }, 'Account')
  } catch (err) {
    return next(err)
  }
}

module.exports = { signup, login, me }
