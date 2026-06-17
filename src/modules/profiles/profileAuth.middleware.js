const jwt = require('jsonwebtoken')
const { unauthorized } = require('../../utils/response')

/**
 * Auth for the isolated Profilo user system. Tokens are signed with the shared
 * JWT secret but carry scope:'profile' so they are accepted ONLY here (and never
 * mistaken for a main-app session). These tokens do NOT use the shared Token
 * collection — the profile flow is self-contained.
 */
function signProfileToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, scope: 'profile' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_PROFILE_EXPIRY || '30d' }
  )
}

function decodeProfileToken(req) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET)
    if (decoded.scope !== 'profile') return null
    return decoded
  } catch {
    return null
  }
}

async function requireProfileUser(req, res, next) {
  const decoded = decodeProfileToken(req)
  if (!decoded) return unauthorized(res, 'Login required')
  req.user = { userId: decoded.userId, email: decoded.email }
  next()
}

function optionalProfileAuth(req, _res, next) {
  const decoded = decodeProfileToken(req)
  if (decoded) req.user = { userId: decoded.userId, email: decoded.email }
  next()
}

module.exports = { signProfileToken, requireProfileUser, optionalProfileAuth }
