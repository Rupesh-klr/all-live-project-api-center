const jwt = require('jsonwebtoken')
const Token = require('../models/Token.model')
const { unauthorized } = require('../utils/response')

/**
 * Verifies the Bearer JWT and confirms the token is still active in the DB.
 * Attaches req.user = { userId, username, role, moduleAccess } on success.
 */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return unauthorized(res, 'No token provided')

  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)

    // Check active status in DB
    const record = await Token.findOne({ accessToken: token, isActive: true })
    if (!record) return unauthorized(res, 'Session expired or revoked — please login again')

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      moduleAccess: decoded.moduleAccess || [],
    }
    next()
  } catch (err) {
    return unauthorized(res, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
  }
}

/**
 * Role-based access control factory.
 * Usage: requireRole('admin') or requireRole(['admin', 'manager'])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (!req.user) return unauthorized(res)
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role '${req.user.role}' cannot access this resource` })
    }
    next()
  }
}

module.exports = { authMiddleware, requireRole }
