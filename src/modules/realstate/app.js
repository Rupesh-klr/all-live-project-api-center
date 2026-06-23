const { Router } = require('express')
const ctrl = require('./realstate.controller')
const { requireAuth, requireAdmin, requireVendor } = require('./realstate.middleware')

/**
 * @module realstate
 * Role-based real-estate marketplace. Mounted by the loader at /api/realstate/v1.
 *
 * Roles (on the shared User model):
 *   user        → browse approved listings, show interest, message (capped)
 *   vendor      → create/edit/delete own listings, reply to inquiries
 *   admin       → migrate listing status, manage roles (no super-admin), approve threads
 *   super-admin → everything, incl. minting admins/super-admins
 *
 * Auth is the shared module (/api/auth/v1) — login/register/refresh live there.
 */
const router = Router()

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/company', ctrl.company)
router.get('/properties', ctrl.listProperties)

// ── Vendor: own listings (static + own routes before "/properties/:id") ─────────
router.get('/vendor/properties', requireAuth, requireVendor, ctrl.vendorProperties)
router.get('/vendor/inquiries', requireAuth, requireVendor, ctrl.vendorInquiries)
router.post('/properties', requireAuth, requireVendor, ctrl.createProperty)

// ── Authenticated buyer actions ─────────────────────────────────────────────────
router.get('/me/interests', requireAuth, ctrl.myInterests)
router.post('/properties/:id/interest', requireAuth, ctrl.showInterest)
router.post('/inquiries/:id/messages', requireAuth, ctrl.sendMessage)

// ── Admin / super-admin ───────────────────────────────────────────────────────────
router.get('/admin/properties', requireAuth, requireAdmin, ctrl.adminProperties)
router.get('/admin/inquiries/pending', requireAuth, requireAdmin, ctrl.pendingApprovals)
router.patch('/inquiries/:id/approve', requireAuth, requireAdmin, ctrl.approveInquiry)
router.get('/admin/users', requireAuth, requireAdmin, ctrl.listUsers)
router.patch('/admin/users/:id/role', requireAuth, requireAdmin, ctrl.changeRole)
router.post('/admin/users', requireAuth, requireAdmin, ctrl.createUser)
router.get('/admin/stats', requireAuth, requireAdmin, ctrl.stats)

// ── Property by id (status migration is admin-gated; edit/delete owner-gated) ──────
router.patch('/properties/:id/status', requireAuth, requireAdmin, ctrl.setStatus)
router.put('/properties/:id', requireAuth, requireVendor, ctrl.updateProperty)
router.delete('/properties/:id', requireAuth, requireVendor, ctrl.deleteProperty)
router.get('/properties/:id', ctrl.getProperty) // public — keep last so it doesn't shadow the above

const meta = {
  name: 'realstate',
  version: 'v1',
  description: 'Role-based real-estate marketplace — vendor listings, admin-moderated approvals & messaging',
  active: true,
  tech: ['Express', 'MongoDB', 'JWT', 'RBAC'],
  highlights: [
    'Super-admin / admin / vendor / user role hierarchy',
    'Listing lifecycle: pending → in-process → approved/rejected',
    'Capped buyer↔vendor messaging with admin approval gate',
    'Reuses the shared auth + encryption + rate-limit stack',
  ],
  defaultUsers: [
    { username: 'superadmin', role: 'super-admin', description: 'Owner — superadmin@estatehub.example / Super@123' },
    { username: 'vendor1', role: 'vendor', description: 'Sample vendor — vendor1@estatehub.example / Vendor@123' },
  ],
}

module.exports = { router, meta }
