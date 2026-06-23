const jwt = require('jsonwebtoken')
const User = require('../../models/User.model')
const Token = require('../../models/Token.model')
const logger = require('../../utils/logger')

function parseDuration(d) {
  const unit = d.slice(-1)
  const val = parseInt(d, 10)
  const map = { s: 1, m: 60, h: 3600, d: 86400 }
  return (map[unit] || 60) * val * 1000
}

async function findUserByIdentifier(identifier) {
  return User.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() },
      { phoneNumber: identifier },
    ],
    isActive: true,
  }).select('+passwordHash')
}

function signTokens(user) {
  const payload = {
    userId: user._id,
    username: user.username,
    role: user.role,
    moduleAccess: user.moduleAccess,
  }
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  })
  const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d',
  })
  return { accessToken, refreshToken }
}

async function createTokenRecord(user, meta = {}) {
  return Token.create({
    userId: user._id,
    accessToken:  meta.accessToken,
    refreshToken: meta.refreshToken,
    isActive: true,
    ipAddress: meta.ip,
    userAgent: meta.ua,
    accessExpiresAt:  new Date(Date.now() + parseDuration(process.env.JWT_ACCESS_EXPIRY || '15m')),
    refreshExpiresAt: new Date(Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRY || '30d')),
  })
}

async function login(identifier, password, meta = {}) {
  const user = await findUserByIdentifier(identifier)
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  const valid = await user.comparePassword(password)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  const { accessToken, refreshToken } = signTokens(user)
  await createTokenRecord(user, { accessToken, refreshToken, ...meta })
  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() })
  logger.info(`Login success: ${user.username}`, { ip: meta.ip })

  return { accessToken, refreshToken, user: user.toJSON() }
}

async function refreshAccess(refreshToken) {
  let decoded
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 })
  }

  const record = await Token.findOne({ refreshToken, isActive: true })
  if (!record) throw Object.assign(new Error('Refresh token revoked'), { status: 401 })

  const user = await User.findById(decoded.userId)
  if (!user || !user.isActive) throw Object.assign(new Error('User not found or inactive'), { status: 401 })

  const { accessToken, refreshToken: newRefresh } = signTokens(user)

  record.isActive = false
  await record.save()

  await createTokenRecord(user, { accessToken, refreshToken: newRefresh })

  return { accessToken, refreshToken: newRefresh }
}

async function logout(accessToken) {
  await Token.findOneAndUpdate({ accessToken }, { isActive: false })
  logger.info('Logout: token revoked')
}

// Register — creates user and auto-logs in (returns tokens so UI goes straight to dashboard)
async function register(data, meta = {}) {
  const exists = await User.findOne({
    $or: [{ username: data.username }, { email: data.email }]
  })
  if (exists) throw Object.assign(new Error('Username or email already taken'), { status: 409 })

  const user = await User.create({
    username:     data.username,
    email:        data.email,
    phoneNumber:  data.phoneNumber,
    passwordHash: data.password,   // pre-save hook will hash this
    displayName:  data.displayName || data.username,
    role:         'user',          // common signups are base "user"; roles elevated by admins
    moduleAccess: [],              // empty = access to all modules
  })

  // Auto-login after registration — return tokens so frontend redirects to dashboard
  const { accessToken, refreshToken } = signTokens(user)
  await createTokenRecord(user, { accessToken, refreshToken, ...meta })
  logger.info(`New user registered: ${user.username}`)

  return { accessToken, refreshToken, user: user.toJSON() }
}

// Guest — creates a temporary user, auto-expires in 7 days
async function guestRegister(meta = {}) {
  const suffix = Math.random().toString(36).slice(2, 8)
  const username = `guest_${suffix}`
  const email = `${username}@guest.hub`
  // Random password — guest never needs to know it; they use the token
  const tempPassword = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

  const user = await User.create({
    username,
    email,
    passwordHash: tempPassword,
    displayName: `Guest ${suffix.toUpperCase()}`,
    role: 'guest',
    moduleAccess: [],   // can see all dashboards
    expiresAt,          // TTL index auto-deletes user document after this date
  })

  const { accessToken, refreshToken } = signTokens(user)
  await createTokenRecord(user, { accessToken, refreshToken, ...meta })
  logger.info(`Guest created: ${username} — auto-deletes ${expiresAt.toISOString()}`)

  return { accessToken, refreshToken, user: user.toJSON(), expiresAt }
}

module.exports = { login, logout, refreshAccess, register, guestRegister }
