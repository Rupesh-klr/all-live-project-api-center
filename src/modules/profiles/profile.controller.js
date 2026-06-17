const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const Profile = require('./profile.model')
const plans = require('./plans.json')
const defaultProfile = require('./default-profile.json')
const { ok, created, badRequest, conflict, notFound } = require('../../utils/response')
const logger = require('../../utils/logger')

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/ // 2–40 chars, no leading/trailing dash
const RESERVED = new Set(['plans', 'health', 'api', 'admin', 'profiles', 'default', 'auth'])

const planFor = (p) => plans[p] || plans.free

// Owner-safe view (never leaks editKeyHash).
function toPublic(p, { full = false } = {}) {
  const base = {
    slug: p.slug,
    displayName: p.displayName,
    plan: p.plan,
    planExpiresAt: p.planExpiresAt,
    published: p.published,
    meta: p.meta,
    pages: p.pages,
    pageCount: Array.isArray(p.pages) ? p.pages.length : 0,
    features: planFor(p.plan).features,
    maxPages: planFor(p.plan).maxPages,
    updatedAt: p.updatedAt,
  }
  if (full) {
    base.ownerUserId = p.ownerUserId
    base.views = p.views
    base.createdAt = p.createdAt
  }
  return base
}

function validatePages(pages, plan, res) {
  if (pages == null) return true
  if (!Array.isArray(pages)) {
    badRequest(res, '`pages` must be an array')
    return false
  }
  const max = planFor(plan).maxPages
  if (pages.length > max) {
    badRequest(res, `Plan "${plan}" allows up to ${max} pages — you sent ${pages.length}. Upgrade to publish more.`)
    return false
  }
  return true
}

/** GET /plans — pricing/limits config (editable in plans.json). */
function getPlans(_req, res) {
  return ok(res, { plans }, 'Available plans')
}

/**
 * POST / — create a profile.
 * body: { slug, editKey?, displayName?, meta?, pages?, plan? }
 * Returns the one-time editKey (store it!) plus the profile.
 */
async function create(req, res, next) {
  try {
    const slug = String(req.body?.slug || '').toLowerCase().trim()
    if (!SLUG_RE.test(slug)) return badRequest(res, 'slug must be 2–40 chars: lowercase letters, numbers and dashes')
    if (RESERVED.has(slug)) return conflict(res, `"${slug}" is reserved`)
    if (await Profile.exists({ slug })) return conflict(res, `Profile "${slug}" already exists`)

    const plan = plans[req.body?.plan] ? req.body.plan : 'free'
    if (!validatePages(req.body?.pages, plan, res)) return

    const editKey = req.body?.editKey ? String(req.body.editKey) : uuidv4()
    const editKeyHash = await bcrypt.hash(editKey, 10)

    const profile = await Profile.create({
      slug,
      displayName: req.body?.displayName || '',
      meta: req.body?.meta || {},
      pages: req.body?.pages || [],
      plan,
      planExpiresAt: plan === 'advanced' ? new Date(Date.now() + 365 * 86400000) : null,
      ownerUserId: req.user?.userId || null, // if called with a JWT, tie to that user
      editKeyHash,
      published: false,
    })

    logger.info(`[profiles] created "${slug}" (plan=${plan})`)
    // editKey is shown ONCE — it is never retrievable again.
    return created(res, { editKey, profile: toPublic(profile, { full: true }) }, 'Profile created — save your editKey, it is shown only once')
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /:slug — public resolver.
 * If a PUBLISHED profile exists → returns its data. Otherwise returns the
 * default/basic template with isDefault=true (so the renderer always renders).
 * ?page=<pageSlug> returns a single page's json.
 */
async function getPublic(req, res, next) {
  try {
    const slug = String(req.params.slug || '').toLowerCase()
    const profile = await Profile.findOne({ slug, published: true })

    if (!profile) {
      return ok(res, { slug, isDefault: true, data: defaultProfile }, 'Default template (no published profile for this slug)')
    }

    Profile.updateOne({ _id: profile._id }, { $inc: { views: 1 } }).catch(() => {})

    const pageSlug = req.query.page
    if (pageSlug != null) {
      const page = (profile.pages || []).find((pg) => pg.slug === String(pageSlug))
      if (!page) return notFound(res, `Page "${pageSlug}" not found in "${slug}"`)
      return ok(res, { slug, isDefault: false, meta: profile.meta, page }, 'Page')
    }

    return ok(
      res,
      {
        slug,
        isDefault: false,
        plan: profile.plan,
        features: planFor(profile.plan).features,
        meta: profile.meta,
        pages: profile.pages,
      },
      'Profile'
    )
  } catch (err) {
    return next(err)
  }
}

/** GET /:slug/admin — full owner view (requireProfileOwner). */
function getAdmin(req, res) {
  return ok(res, { profile: toPublic(req.profile, { full: true }) }, 'Profile (owner view)')
}

/** PUT /:slug — update meta/pages/displayName (requireProfileOwner). */
async function update(req, res, next) {
  try {
    const p = req.profile
    if (!validatePages(req.body?.pages, p.plan, res)) return

    if (req.body?.displayName != null) p.displayName = req.body.displayName
    if (req.body?.meta != null) p.meta = req.body.meta
    if (req.body?.pages != null) p.pages = req.body.pages
    await p.save()

    return ok(res, { profile: toPublic(p, { full: true }) }, 'Profile updated')
  } catch (err) {
    return next(err)
  }
}

/** POST /:slug/publish and /:slug/unpublish (requireProfileOwner). */
async function publish(req, res, next) {
  try {
    const p = req.profile
    if (!p.pages?.length) return badRequest(res, 'Add at least one page before publishing')
    p.published = true
    await p.save()
    return ok(res, { profile: toPublic(p) }, 'Profile published')
  } catch (err) {
    return next(err)
  }
}

async function unpublish(req, res, next) {
  try {
    const p = req.profile
    p.published = false
    await p.save()
    return ok(res, { profile: toPublic(p) }, 'Profile unpublished')
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /:slug/plan — set the plan (requireProfileOwner).
 * Payment is out of scope for now; this just switches tier + sets expiry.
 */
async function setPlan(req, res, next) {
  try {
    const next_ = String(req.body?.plan || '')
    if (!plans[next_]) return badRequest(res, `Unknown plan "${next_}". Valid: ${Object.keys(plans).join(', ')}`)
    const p = req.profile
    // Downgrading below current page count is blocked.
    if ((p.pages?.length || 0) > planFor(next_).maxPages) {
      return badRequest(res, `Plan "${next_}" allows ${planFor(next_).maxPages} pages but this profile has ${p.pages.length}. Remove pages first.`)
    }
    p.plan = next_
    p.planExpiresAt = next_ === 'advanced' ? new Date(Date.now() + 365 * 86400000) : null
    await p.save()
    return ok(res, { profile: toPublic(p, { full: true }) }, `Plan set to ${next_}`)
  } catch (err) {
    return next(err)
  }
}

/** DELETE /:slug (requireProfileOwner). */
async function remove(req, res, next) {
  try {
    await Profile.deleteOne({ _id: req.profile._id })
    return ok(res, { slug: req.profile.slug }, 'Profile deleted')
  } catch (err) {
    return next(err)
  }
}

module.exports = { getPlans, create, getPublic, getAdmin, update, publish, unpublish, setPlan, remove }
