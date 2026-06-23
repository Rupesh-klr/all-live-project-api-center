const svc = require('./realstate.service')
const { ok, created, serverError } = require('../../utils/response')
const { parsePagination, buildPageMeta } = require('../../utils/pagination')
const { COMPANY, TESTIMONIALS } = require('./realstate.constants')
const logger = require('../../utils/logger')

// Maps a thrown { status } error onto the right HTTP response.
function fail(res, errObj, where) {
  const status = errObj.status || 500
  if (status >= 500) {
    logger.error(`[realstate] ${where}: ${errObj.message}`, { stack: errObj.stack })
    return serverError(res)
  }
  return res.status(status).json({ success: false, message: errObj.message })
}

const send = (res, { items, total }, { page, limit }, message) =>
  res.status(200).json({ success: true, message, data: items, pagination: buildPageMeta({ page, limit, total }) })

/**
 * @swagger
 * /api/realstate/v1/company:
 *   get:
 *     tags: [RealEstate]
 *     summary: Public company profile + testimonials for the landing page
 */
function company(_req, res) {
  return ok(res, { company: COMPANY, testimonials: TESTIMONIALS }, 'Company profile')
}

/**
 * @swagger
 * /api/realstate/v1/properties:
 *   get:
 *     tags: [RealEstate]
 *     summary: Public list of approved listings (filters - city, minPrice, maxPrice, minSize)
 */
async function listProperties(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listPublicProperties(pg, req.query)
    return send(res, result, pg, 'Approved listings')
  } catch (e) { return fail(res, e, 'listProperties') }
}

/**
 * @swagger
 * /api/realstate/v1/properties/{id}:
 *   get:
 *     tags: [RealEstate]
 *     summary: Public single approved listing
 */
async function getProperty(req, res) {
  try {
    const data = await svc.getPublicProperty(req.params.id)
    return ok(res, { property: data }, 'Listing')
  } catch (e) { return fail(res, e, 'getProperty') }
}

// ── vendor ───────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/realstate/v1/properties:
 *   post:
 *     tags: [RealEstate]
 *     summary: Vendor creates a listing (starts as pending). Requires title, location, size, originalPrice
 *     security: [{ bearerAuth: [] }]
 */
async function createProperty(req, res) {
  try {
    const data = await svc.createProperty(req.user.userId, req.body)
    return created(res, { property: data }, 'Listing created — pending admin approval')
  } catch (e) { return fail(res, e, 'createProperty') }
}

async function updateProperty(req, res) {
  try {
    const data = await svc.updateProperty(req.params.id, req.user, req.body)
    return ok(res, { property: data }, 'Listing updated')
  } catch (e) { return fail(res, e, 'updateProperty') }
}

async function deleteProperty(req, res) {
  try {
    const data = await svc.deleteProperty(req.params.id, req.user)
    return ok(res, data, 'Listing deleted')
  } catch (e) { return fail(res, e, 'deleteProperty') }
}

async function vendorProperties(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listVendorProperties(req.user.userId, pg)
    return send(res, result, pg, 'Your listings')
  } catch (e) { return fail(res, e, 'vendorProperties') }
}

async function vendorInquiries(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listVendorInquiries(req.user.userId, pg)
    return send(res, result, pg, 'Inquiries on your listings')
  } catch (e) { return fail(res, e, 'vendorInquiries') }
}

// ── interest + messaging ───────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/realstate/v1/properties/{id}/interest:
 *   post:
 *     tags: [RealEstate]
 *     summary: Buyer shows interest in a listing (optionally with a first message)
 *     security: [{ bearerAuth: [] }]
 */
async function showInterest(req, res) {
  try {
    const data = await svc.createInterest(req.params.id, req.user, req.body?.message)
    return created(res, { inquiry: data }, 'Interest recorded')
  } catch (e) { return fail(res, e, 'showInterest') }
}

/**
 * @swagger
 * /api/realstate/v1/inquiries/{id}/messages:
 *   post:
 *     tags: [RealEstate]
 *     summary: Post a message in a thread (capped - 3 user / 3 vendor, then admin approval)
 *     security: [{ bearerAuth: [] }]
 */
async function sendMessage(req, res) {
  try {
    const data = await svc.addMessage(req.params.id, req.user, req.body?.message)
    return ok(res, { inquiry: data }, 'Message sent')
  } catch (e) { return fail(res, e, 'sendMessage') }
}

async function myInterests(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listUserInterests(req.user.userId, pg)
    return send(res, result, pg, 'Your interests')
  } catch (e) { return fail(res, e, 'myInterests') }
}

// ── admin: properties ───────────────────────────────────────────────────────────────
async function adminProperties(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listAllProperties(pg, req.query)
    return send(res, result, pg, 'All listings')
  } catch (e) { return fail(res, e, 'adminProperties') }
}

/**
 * @swagger
 * /api/realstate/v1/properties/{id}/status:
 *   patch:
 *     tags: [RealEstate]
 *     summary: Admin/super-admin migrates a listing status (pending|in-process|approved|rejected)
 *     security: [{ bearerAuth: [] }]
 */
async function setStatus(req, res) {
  try {
    const data = await svc.setPropertyStatus(req.params.id, req.body?.status, req.body?.note, req.user.userId)
    return ok(res, { property: data }, `Listing status set to ${req.body?.status}`)
  } catch (e) { return fail(res, e, 'setStatus') }
}

async function pendingApprovals(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listPendingApprovals(pg)
    return send(res, result, pg, 'Conversations awaiting approval')
  } catch (e) { return fail(res, e, 'pendingApprovals') }
}

/**
 * @swagger
 * /api/realstate/v1/inquiries/{id}/approve:
 *   patch:
 *     tags: [RealEstate]
 *     summary: Admin approves a frozen conversation so messaging can resume
 *     security: [{ bearerAuth: [] }]
 */
async function approveInquiry(req, res) {
  try {
    const data = await svc.approveInquiry(req.params.id, req.user.userId)
    return ok(res, { inquiry: data }, 'Conversation approved')
  } catch (e) { return fail(res, e, 'approveInquiry') }
}

// ── admin: users / roles ─────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  const pg = parsePagination(req)
  try {
    const result = await svc.listUsers(pg, req.query)
    return send(res, result, pg, 'Users')
  } catch (e) { return fail(res, e, 'listUsers') }
}

/**
 * @swagger
 * /api/realstate/v1/admin/users/{id}/role:
 *   patch:
 *     tags: [RealEstate]
 *     summary: Change a user's role (escalation-protected)
 *     security: [{ bearerAuth: [] }]
 */
async function changeRole(req, res) {
  try {
    const data = await svc.changeUserRole(req.params.id, req.body?.role, req.user)
    return ok(res, { user: data }, 'Role updated')
  } catch (e) { return fail(res, e, 'changeRole') }
}

/**
 * @swagger
 * /api/realstate/v1/admin/users:
 *   post:
 *     tags: [RealEstate]
 *     summary: Super-admin creates an elevated account (super-admin/admin/vendor)
 *     security: [{ bearerAuth: [] }]
 */
async function createUser(req, res) {
  try {
    const data = await svc.createElevatedUser(req.body, req.user)
    return created(res, { user: data }, 'User created')
  } catch (e) { return fail(res, e, 'createUser') }
}

async function stats(req, res) {
  try {
    const data = await svc.adminStats()
    return ok(res, data, 'Module stats')
  } catch (e) { return fail(res, e, 'stats') }
}

module.exports = {
  company,
  listProperties, getProperty,
  createProperty, updateProperty, deleteProperty, vendorProperties, vendorInquiries,
  showInterest, sendMessage, myInterests,
  adminProperties, setStatus, pendingApprovals, approveInquiry,
  listUsers, changeRole, createUser, stats,
}
