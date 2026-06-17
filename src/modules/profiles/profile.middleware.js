const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const Profile = require('./profile.model')
const { notFound, forbidden } = require('../../utils/response')

/**
 * Per-profile ownership guard. Loads the profile by :slug onto req.profile, then
 * authorizes EITHER of:
 *   • a logged-in owner — Bearer JWT whose userId === profile.ownerUserId, or
 *   • the per-profile secret — header `x-edit-key` (or body.editKey) that matches
 *     the bcrypt hash stored at creation.
 */
async function requireProfileOwner(req, res, next) {
  try {
    const slug = String(req.params.slug || '').toLowerCase()
    const profile = await Profile.findOne({ slug })
    if (!profile) return notFound(res, 'Profile not found')
    req.profile = profile

    // Option A — JWT owner (reuses the platform's existing auth)
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ') && profile.ownerUserId) {
      try {
        const decoded = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET)
        if (String(decoded.userId) === String(profile.ownerUserId)) {
          req.profileAuth = 'jwt'
          return next()
        }
      } catch { /* fall through to edit key */ }
    }

    // Option B — per-profile edit key
    const editKey = req.headers['x-edit-key'] || req.body?.editKey
    if (editKey && (await bcrypt.compare(String(editKey), profile.editKeyHash))) {
      req.profileAuth = 'editKey'
      return next()
    }

    return forbidden(res, 'Invalid edit key or token for this profile')
  } catch (err) {
    return next(err)
  }
}

module.exports = { requireProfileOwner }
