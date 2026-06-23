/**
 * Real-Estate module — shared constants.
 * Single source of truth for statuses, role sets, messaging caps and the
 * sample company profile rendered on the public landing page.
 */

// Property listing lifecycle. Only `approved` listings are publicly visible.
const PROPERTY_STATUS = {
  PENDING: 'pending',
  IN_PROCESS: 'in-process',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}
const PROPERTY_STATUSES = Object.values(PROPERTY_STATUS)

// Inquiry messaging caps. Once both sides exhaust their quota the thread is
// frozen (approvalRequired) until an admin/super-admin approves continuation.
const MSG_LIMITS = { user: 3, vendor: 3 }

// Max photos a vendor may attach to a listing.
const MAX_PHOTOS = 3

// Role sets reused by route guards (kept here so controllers/middleware agree).
const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  VENDOR: 'vendor',
  USER: 'user',
}
// Anyone who can administrate the module (status migration, role changes, approvals).
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN]
// Roles an admin (non-super) is allowed to assign.
const ADMIN_ASSIGNABLE = [ROLES.USER, ROLES.VENDOR, ROLES.ADMIN]
// Roles a super-admin is allowed to assign (everything in the real-estate set).
const SUPER_ASSIGNABLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.VENDOR, ROLES.USER]

const SIZE_UNITS = ['sqft', 'sqyd', 'sqm', 'acre', 'hectare']

// Sample real-estate company shown on the public landing (overridable via env later).
const COMPANY = {
  name: process.env.REALSTATE_COMPANY_NAME || 'Estate Hub Realty',
  tagline: 'Verified plots & flats — connect directly with trusted vendors.',
  description:
    'Estate Hub is a curated property marketplace. Every listing is reviewed by our team before it goes live, so buyers browse only verified plots and flats and talk directly to the listing vendor.',
  founded: 2019,
  phone: '+91 98765 43210',
  email: 'hello@estatehub.example',
  address: 'Tower B, Cyber Greens, Gurugram, Haryana 122002',
  stats: [
    { value: 'Verified', label: 'Listings reviewed before going live' },
    { value: 'Direct', label: 'Talk to the vendor, no middlemen' },
    { value: 'Secure', label: 'Admin-moderated conversations' },
  ],
}

const TESTIMONIALS = [
  { name: 'Aarti Mehra', role: 'Home buyer', text: 'Found a verified plot and spoke to the owner directly. The whole process felt safe and transparent.' },
  { name: 'Rohit Sharma', role: 'Vendor', text: 'Listed three plots in minutes. The approval step gives buyers real confidence in my listings.' },
  { name: 'Sneha Kulkarni', role: 'Investor', text: 'I love that conversations are moderated. No spam, just genuine interest from real buyers.' },
]

module.exports = {
  PROPERTY_STATUS,
  PROPERTY_STATUSES,
  MSG_LIMITS,
  MAX_PHOTOS,
  ROLES,
  ADMIN_ROLES,
  ADMIN_ASSIGNABLE,
  SUPER_ASSIGNABLE,
  SIZE_UNITS,
  COMPANY,
  TESTIMONIALS,
}
