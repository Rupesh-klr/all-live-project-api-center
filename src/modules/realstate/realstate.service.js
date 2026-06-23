const mongoose = require('mongoose')
const User = require('../../models/User.model')
const Property = require('./property.model')
const Inquiry = require('./inquiry.model')
const logger = require('../../utils/logger')
const {
  PROPERTY_STATUS,
  PROPERTY_STATUSES,
  MSG_LIMITS,
  MAX_PHOTOS,
  ROLES,
  ADMIN_ROLES,
  ADMIN_ASSIGNABLE,
  SUPER_ASSIGNABLE,
  SIZE_UNITS,
} = require('./realstate.constants')

// ── helpers ────────────────────────────────────────────────────────────────────
const err = (message, status = 400) => Object.assign(new Error(message), { status })
const isId = (id) => mongoose.Types.ObjectId.isValid(id)
const isAdmin = (role) => ADMIN_ROLES.includes(role)

// Validate + normalise a property payload (used by create and update).
// `partial` = true skips required-field checks for PATCH/PUT of existing docs.
function sanitizePropertyInput(body = {}, { partial = false } = {}) {
  const out = {}

  if (!partial || body.title !== undefined) {
    if (!String(body.title || '').trim()) throw err('title is required')
    out.title = String(body.title).trim().slice(0, 140)
  }
  if (body.description !== undefined) out.description = String(body.description || '').trim().slice(0, 4000)

  // Location (mandatory on create).
  if (!partial || body.location !== undefined) {
    const loc = body.location || {}
    if (!String(loc.address || '').trim()) throw err('location.address is required')
    if (!String(loc.city || '').trim()) throw err('location.city is required')
    out.location = {
      address: String(loc.address).trim(),
      city: String(loc.city).trim().toLowerCase(),
      state: String(loc.state || '').trim(),
      lat: loc.lat != null && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null,
      lng: loc.lng != null && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null,
    }
  }

  // Size (mandatory on create).
  if (!partial || body.size !== undefined) {
    const size = Number(body.size)
    if (!Number.isFinite(size) || size < 1) throw err('size must be a positive number')
    out.size = size
  }
  if (body.sizeUnit !== undefined) {
    if (!SIZE_UNITS.includes(body.sizeUnit)) throw err(`sizeUnit must be one of: ${SIZE_UNITS.join(', ')}`)
    out.sizeUnit = body.sizeUnit
  }

  // Price (mandatory on create).
  if (!partial || body.originalPrice !== undefined) {
    const price = Number(body.originalPrice)
    if (!Number.isFinite(price) || price < 0) throw err('originalPrice must be a non-negative number')
    out.originalPrice = price
  }
  if (body.discountPercent !== undefined) {
    const d = Number(body.discountPercent)
    if (!Number.isFinite(d) || d < 0 || d > 90) throw err('discountPercent must be between 0 and 90')
    out.discountPercent = d
  }

  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) throw err('photos must be an array of URLs')
    if (body.photos.length > MAX_PHOTOS) throw err(`A listing may have at most ${MAX_PHOTOS} photos`)
    const photos = body.photos.map((p) => String(p).trim()).filter(Boolean)
    if (!photos.every((u) => /^https?:\/\/.+/i.test(u))) throw err('Each photo must be a valid http(s) URL')
    out.photos = photos
  }

  return out
}

// ── public catalogue ────────────────────────────────────────────────────────────
async function listPublicProperties({ page, limit, skip }, filters = {}) {
  const q = { status: PROPERTY_STATUS.APPROVED }
  if (filters.city) q['location.city'] = String(filters.city).toLowerCase().trim()

  const price = {}
  if (Number.isFinite(Number(filters.minPrice))) price.$gte = Number(filters.minPrice)
  if (Number.isFinite(Number(filters.maxPrice))) price.$lte = Number(filters.maxPrice)
  if (Object.keys(price).length) q.originalPrice = price

  if (Number.isFinite(Number(filters.minSize))) q.size = { $gte: Number(filters.minSize) }

  const [docs, total] = await Promise.all([
    Property.find(q).sort({ featured: -1, createdAt: -1 }).skip(skip).limit(limit),
    Property.countDocuments(q),
  ])
  return { items: docs.map((d) => d.toPublic()), total }
}

async function getPublicProperty(id) {
  if (!isId(id)) throw err('Invalid property id', 400)
  const doc = await Property.findOne({ _id: id, status: PROPERTY_STATUS.APPROVED })
  if (!doc) throw err('Property not found', 404)
  Property.updateOne({ _id: id }, { $inc: { views: 1 } }).catch(() => {})
  return doc.toPublic()
}

// ── vendor: own listings ─────────────────────────────────────────────────────────
async function createProperty(vendorId, body) {
  const data = sanitizePropertyInput(body, { partial: false })
  const doc = await Property.create({ ...data, vendorId, status: PROPERTY_STATUS.PENDING })
  logger.info(`[realstate] property created ${doc._id} by vendor ${vendorId}`)
  return doc.toPublic({ full: true })
}

// Loads a property and asserts the actor may modify it (owner vendor, or any admin).
async function loadOwnedProperty(id, actor) {
  if (!isId(id)) throw err('Invalid property id', 400)
  const doc = await Property.findById(id)
  if (!doc) throw err('Property not found', 404)
  if (!isAdmin(actor.role) && String(doc.vendorId) !== String(actor.userId)) {
    throw err('You do not own this listing', 403)
  }
  return doc
}

async function updateProperty(id, actor, body) {
  const doc = await loadOwnedProperty(id, actor)
  const data = sanitizePropertyInput(body, { partial: true })
  Object.assign(doc, data)
  // Vendor edits send the listing back through review (unless an admin edits it).
  if (!isAdmin(actor.role)) doc.status = PROPERTY_STATUS.PENDING
  await doc.save()
  return doc.toPublic({ full: true })
}

async function deleteProperty(id, actor) {
  const doc = await loadOwnedProperty(id, actor)
  await Promise.all([
    Property.deleteOne({ _id: doc._id }),
    Inquiry.deleteMany({ propertyId: doc._id }),
  ])
  return { id }
}

async function listVendorProperties(vendorId, { page, limit, skip }) {
  const [docs, total] = await Promise.all([
    Property.find({ vendorId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Property.countDocuments({ vendorId }),
  ])
  return { items: docs.map((d) => d.toPublic({ full: true })), total }
}

// ── admin: status migration ───────────────────────────────────────────────────────
async function setPropertyStatus(id, status, note, adminId) {
  if (!isId(id)) throw err('Invalid property id', 400)
  if (!PROPERTY_STATUSES.includes(status)) {
    throw err(`status must be one of: ${PROPERTY_STATUSES.join(', ')}`)
  }
  const doc = await Property.findById(id)
  if (!doc) throw err('Property not found', 404)
  doc.status = status
  doc.statusNote = note ? String(note).slice(0, 500) : ''
  await doc.save()
  logger.info(`[realstate] property ${id} → ${status} by admin ${adminId}`)
  return doc.toPublic({ full: true })
}

async function listAllProperties({ page, limit, skip }, filters = {}) {
  const q = {}
  if (filters.status && PROPERTY_STATUSES.includes(filters.status)) q.status = filters.status
  if (filters.city) q['location.city'] = String(filters.city).toLowerCase().trim()
  const [docs, total] = await Promise.all([
    Property.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Property.countDocuments(q),
  ])
  return { items: docs.map((d) => d.toPublic({ full: true })), total }
}

// ── interest + messaging ──────────────────────────────────────────────────────────
// Buyer expresses interest. Creates the thread (idempotent) and posts the first
// message if supplied. Subject to the user message cap.
async function createInterest(propertyId, user, text) {
  if (!isId(propertyId)) throw err('Invalid property id', 400)
  const property = await Property.findOne({ _id: propertyId, status: PROPERTY_STATUS.APPROVED })
  if (!property) throw err('Property not found', 404)
  if (String(property.vendorId) === String(user.userId)) throw err('You cannot show interest in your own listing', 400)

  let inquiry = await Inquiry.findOne({ propertyId, userId: user.userId })
  if (!inquiry) {
    inquiry = await Inquiry.create({ propertyId, userId: user.userId, vendorId: property.vendorId })
  }
  if (text && String(text).trim()) {
    return addMessage(inquiry._id, user, String(text).trim())
  }
  return inquiry.toObject()
}

async function addMessage(inquiryId, actor, text) {
  if (!isId(inquiryId)) throw err('Invalid inquiry id', 400)
  const body = String(text || '').trim()
  if (!body) throw err('Message text is required')
  if (body.length > 2000) throw err('Message too long (max 2000 chars)')

  const inquiry = await Inquiry.findById(inquiryId)
  if (!inquiry) throw err('Inquiry not found', 404)

  // Who is allowed to post here?
  const isThreadUser = String(inquiry.userId) === String(actor.userId)
  const isThreadVendor = String(inquiry.vendorId) === String(actor.userId)
  if (!isThreadUser && !isThreadVendor) throw err('You are not a participant in this conversation', 403)

  const senderRole = isThreadUser ? 'user' : 'vendor'

  // Quota / approval gate — enforced server-side, never trust the client.
  if (inquiry.approvalRequired) {
    throw err('This conversation is awaiting admin approval to continue', 403)
  }
  const used = senderRole === 'user' ? inquiry.userMessageCount : inquiry.vendorReplyCount
  const cap = MSG_LIMITS[senderRole]
  // Each side has an independent quota. Exceeding your own quota is rejected, but
  // the thread is only frozen (admin approval) once BOTH sides are exhausted —
  // so the other party can still use their remaining messages.
  if (used >= cap) {
    if (inquiry.userMessageCount >= MSG_LIMITS.user && inquiry.vendorReplyCount >= MSG_LIMITS.vendor) {
      inquiry.approvalRequired = true
      await inquiry.save()
    }
    throw err(`You have used all ${cap} of your messages. ${inquiry.approvalRequired ? 'An admin must approve before this conversation can continue.' : 'Waiting for the other party to respond.'}`, 403)
  }

  inquiry.messages.push({ senderRole, senderId: actor.userId, text: body })
  if (senderRole === 'user') inquiry.userMessageCount += 1
  else inquiry.vendorReplyCount += 1

  // Freeze the thread the moment BOTH sides are exhausted.
  if (inquiry.userMessageCount >= MSG_LIMITS.user && inquiry.vendorReplyCount >= MSG_LIMITS.vendor) {
    inquiry.approvalRequired = true
  }
  await inquiry.save()
  return inquiry.toObject()
}

async function approveInquiry(inquiryId, adminId) {
  if (!isId(inquiryId)) throw err('Invalid inquiry id', 400)
  const inquiry = await Inquiry.findById(inquiryId)
  if (!inquiry) throw err('Inquiry not found', 404)
  // Approving resets both quotas, granting a fresh round of messages.
  inquiry.approvalRequired = false
  inquiry.userMessageCount = 0
  inquiry.vendorReplyCount = 0
  inquiry.approvedBy = adminId
  inquiry.approvedAt = new Date()
  await inquiry.save()
  logger.info(`[realstate] inquiry ${inquiryId} approved by admin ${adminId}`)
  return inquiry.toObject()
}

async function listUserInterests(userId, { page, limit, skip }) {
  const [docs, total] = await Promise.all([
    Inquiry.find({ userId }).populate('propertyId', 'title location photos status').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Inquiry.countDocuments({ userId }),
  ])
  return { items: docs.map((d) => d.toObject()), total }
}

async function listVendorInquiries(vendorId, { page, limit, skip }) {
  const [docs, total] = await Promise.all([
    Inquiry.find({ vendorId }).populate('propertyId', 'title location photos status').populate('userId', 'username displayName').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Inquiry.countDocuments({ vendorId }),
  ])
  return { items: docs.map((d) => d.toObject()), total }
}

async function listPendingApprovals({ page, limit, skip }) {
  const q = { approvalRequired: true }
  const [docs, total] = await Promise.all([
    Inquiry.find(q).populate('propertyId', 'title').populate('userId', 'username displayName').populate('vendorId', 'username displayName').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Inquiry.countDocuments(q),
  ])
  return { items: docs.map((d) => d.toObject()), total }
}

// ── admin: user / role management ──────────────────────────────────────────────────
function publicUser(u) {
  return {
    id: u._id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
  }
}

async function listUsers({ page, limit, skip }, filters = {}) {
  const q = {}
  if (filters.role) q.role = filters.role
  if (filters.search) {
    const s = String(filters.search).trim()
    q.$or = [{ username: new RegExp(s, 'i') }, { email: new RegExp(s, 'i') }, { displayName: new RegExp(s, 'i') }]
  }
  const [docs, total] = await Promise.all([
    User.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(q),
  ])
  return { items: docs.map(publicUser), total }
}

/**
 * Change a user's role with full escalation protection.
 *  - super-admin: may assign any real-estate role (incl. super-admin/admin).
 *  - admin: may assign user/vendor/admin, but may NOT touch a super-admin
 *    target and may NOT mint a super-admin.
 *  - nobody may demote themselves out of their own admin powers by accident here
 *    (self-edit blocked to avoid lock-out / privilege confusion).
 */
async function changeUserRole(targetId, newRole, actor) {
  if (!isId(targetId)) throw err('Invalid user id', 400)
  if (String(targetId) === String(actor.userId)) throw err('You cannot change your own role', 400)

  const allowed = actor.role === ROLES.SUPER_ADMIN ? SUPER_ASSIGNABLE : ADMIN_ASSIGNABLE
  if (!allowed.includes(newRole)) {
    throw err(`Role '${actor.role}' cannot assign role '${newRole}'`, 403)
  }

  const target = await User.findById(targetId)
  if (!target) throw err('User not found', 404)

  // A non-super admin can never modify a super-admin account.
  if (actor.role !== ROLES.SUPER_ADMIN && target.role === ROLES.SUPER_ADMIN) {
    throw err('Only a super-admin can modify a super-admin account', 403)
  }

  target.role = newRole
  await target.save()
  logger.info(`[realstate] user ${targetId} role → ${newRole} by ${actor.role} ${actor.userId}`)
  return publicUser(target)
}

/**
 * Admin / super-admin: directly create an account.
 *  - super-admin may create any role (incl. admin / super-admin).
 *  - admin may create user / vendor / admin, but NOT super-admin.
 */
async function createElevatedUser(data, actor) {
  const allowed = actor.role === ROLES.SUPER_ADMIN ? SUPER_ASSIGNABLE : ADMIN_ASSIGNABLE
  const role = data.role || ROLES.USER
  if (!allowed.includes(role)) throw err(`Role '${actor.role}' cannot create an account with role '${role}'`, 403)
  if (!data.username || !data.email || !data.password) throw err('username, email and password are required')

  const exists = await User.findOne({ $or: [{ username: String(data.username).toLowerCase() }, { email: String(data.email).toLowerCase() }] })
  if (exists) throw err('Username or email already taken', 409)

  const user = await User.create({
    username: data.username,
    email: data.email,
    phoneNumber: data.phoneNumber,
    passwordHash: data.password, // pre-save hook hashes
    displayName: data.displayName || data.username,
    role,
    moduleAccess: [],
  })
  logger.info(`[realstate] elevated user created ${user._id} role=${role} by super-admin ${actor.userId}`)
  return publicUser(user)
}

// ── stats ─────────────────────────────────────────────────────────────────────────
async function adminStats() {
  const [byStatus, totalProps, totalInquiries, pendingApprovals, byRole] = await Promise.all([
    Property.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Property.countDocuments(),
    Inquiry.countDocuments(),
    Inquiry.countDocuments({ approvalRequired: true }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ])
  const statusMap = Object.fromEntries(PROPERTY_STATUSES.map((s) => [s, 0]))
  byStatus.forEach((r) => { statusMap[r._id] = r.count })
  return {
    properties: { total: totalProps, byStatus: statusMap },
    inquiries: { total: totalInquiries, pendingApprovals },
    usersByRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
  }
}

module.exports = {
  // public
  listPublicProperties,
  getPublicProperty,
  // vendor
  createProperty,
  updateProperty,
  deleteProperty,
  listVendorProperties,
  listVendorInquiries,
  // admin properties
  setPropertyStatus,
  listAllProperties,
  // interest + messaging
  createInterest,
  addMessage,
  approveInquiry,
  listUserInterests,
  listPendingApprovals,
  // admin users
  listUsers,
  changeUserRole,
  createElevatedUser,
  // stats
  adminStats,
}
