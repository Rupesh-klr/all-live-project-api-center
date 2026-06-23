const { ROLES } = require('./realstate.constants')

/**
 * Real-estate module guards. These build on the shared
 * `middleware/auth.middleware.js` (authMiddleware + requireRole) — they do not
 * reimplement JWT verification, only module-specific role groupings.
 */
const { authMiddleware, requireRole } = require('../../middleware/auth.middleware')

const requireAuth = authMiddleware
const requireAdmin = requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN])
const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN)
const requireVendor = requireRole([ROLES.VENDOR, ROLES.ADMIN, ROLES.SUPER_ADMIN])

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, requireVendor }
