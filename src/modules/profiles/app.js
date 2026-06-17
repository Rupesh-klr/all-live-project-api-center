const { Router } = require('express')
const ctrl = require('./profile.controller')
const ctrlAuth = require('./profileAuth.controller')
const { requireProfileOwner } = require('./profile.middleware')
const { requireProfileUser, optionalProfileAuth } = require('./profileAuth.middleware')
const { startProfileGitSync } = require('./profile.cron')

/**
 * @module profiles
 * JSON-driven profile pages: create, edit, publish and resolve by slug.
 * Mounted by the module loader at /api/profiles/v1.
 *
 * Public:
 *   GET    /plans            → pricing/limits config
 *   GET    /:slug            → published profile JSON, or the default template (isDefault:true)
 *   GET    /:slug?page=home  → a single page's JSON
 * Owner (x-edit-key header, or Bearer JWT of the owner):
 *   POST   /                 → create (returns one-time editKey)
 *   PUT    /:slug            → update meta/pages/displayName (plan page-limit enforced)
 *   POST   /:slug/publish    → publish
 *   POST   /:slug/unpublish  → unpublish
 *   POST   /:slug/plan       → switch plan (free/advanced)
 *   GET    /:slug/admin      → full owner view
 *   DELETE /:slug            → delete
 */
const router = Router()

// Static paths first so they aren't captured by "/:slug".
router.get('/plans', ctrl.getPlans)

// Isolated profile-builder accounts (separate from the main /api/auth/v1).
router.post('/auth/signup', ctrlAuth.signup)
router.post('/auth/login', ctrlAuth.login)
router.get('/auth/me', requireProfileUser, ctrlAuth.me)

// Create — binds ownerUserId when a profile-account token is supplied.
router.post('/', optionalProfileAuth, ctrl.create)

router.get('/:slug', ctrl.getPublic)
router.get('/:slug/admin', requireProfileOwner, ctrl.getAdmin)
router.put('/:slug', requireProfileOwner, ctrl.update)
router.post('/:slug/publish', requireProfileOwner, ctrl.publish)
router.post('/:slug/unpublish', requireProfileOwner, ctrl.unpublish)
router.post('/:slug/plan', requireProfileOwner, ctrl.setPlan)
router.delete('/:slug', requireProfileOwner, ctrl.remove)

// Optional file-backup cron (no-op unless PROFILE_GIT_SYNC=true).
startProfileGitSync()

const meta = {
  name: 'profiles',
  version: '1.0.0',
  description:
    'JSON-driven profile pages — store, publish and resolve by slug with default-template fallback, per-profile edit-key/JWT ownership, plan page-limits and an AI-suggestion flag.',
  active: true,
}

module.exports = { router, meta }
