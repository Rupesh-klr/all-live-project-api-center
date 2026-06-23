/**
 * Real-estate seed — creates the full role hierarchy + sample listings.
 *
 *   npm run seed:realstate
 *
 * IMPORTANT: this seeds through the Mongoose User model so the pre('save') hook
 * bcrypt-hashes every password. Do NOT insert users with raw mongo/mongosh —
 * that stores plaintext passwords and logins will fail.
 *
 * Idempotent: existing users/properties are skipped (re-running is safe).
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../src/models/User.model')
const Property = require('../src/modules/realstate/property.model')
const { PROPERTY_STATUS } = require('../src/modules/realstate/realstate.constants')

// ── Accounts ──────────────────────────────────────────────────────────────────────
// password column is the PLAINTEXT login password (hashed on save).
const USERS = [
  // 2 super-admins
  { username: 'superadmin', email: 'superadmin@estatehub.example', password: 'Super@123', displayName: 'Estate Owner',     role: 'super-admin' },
  { username: 'owner',      email: 'owner@estatehub.example',      password: 'Owner@123', displayName: 'Co-Founder',        role: 'super-admin' },

  // 2 admins
  { username: 'admin1', email: 'admin1@estatehub.example', password: 'Admin@123', displayName: 'Priya (Admin)',  role: 'admin' },
  { username: 'admin2', email: 'admin2@estatehub.example', password: 'Admin@123', displayName: 'Arjun (Admin)',  role: 'admin' },

  // 3 vendors (each gets sample plots below)
  { username: 'vendor1', email: 'vendor1@estatehub.example', password: 'Vendor@123', displayName: 'Ravi Properties', role: 'vendor' },
  { username: 'vendor2', email: 'vendor2@estatehub.example', password: 'Vendor@123', displayName: 'Mehta Estates',   role: 'vendor' },
  { username: 'vendor3', email: 'vendor3@estatehub.example', password: 'Vendor@123', displayName: 'Coastal Realty',  role: 'vendor' },

  // 4 users (buyers)
  { username: 'user1', email: 'user1@estatehub.example', password: 'User@123', displayName: 'Aarti Mehra',    role: 'user' },
  { username: 'user2', email: 'user2@estatehub.example', password: 'User@123', displayName: 'Rohit Sharma',   role: 'user' },
  { username: 'user3', email: 'user3@estatehub.example', password: 'User@123', displayName: 'Sneha Kulkarni', role: 'user' },
  { username: 'user4', email: 'user4@estatehub.example', password: 'User@123', displayName: 'Imran Khan',     role: 'user' },
]

const IMG = {
  flat:  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
  flat2: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
  plot:  'https://images.unsplash.com/photo-1500382017468-9049fed747ef',
  villa: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6',
  apt:   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00',
}

// Sample listings keyed by vendor username. Mix of statuses so the admin
// workflow (approve/reject/migrate) and the public catalogue both have data.
const PLOTS = {
  vendor1: [
    { title: '3 BHK Flat in Cyber Greens', description: 'Spacious 3BHK, modular kitchen, covered parking, clubhouse access.',
      location: { address: 'Tower C, Cyber Greens', city: 'gurugram', state: 'Haryana' }, size: 1650, sizeUnit: 'sqft',
      originalPrice: 12500000, discountPercent: 5, photos: [IMG.flat, IMG.flat2], status: PROPERTY_STATUS.APPROVED, featured: true },
    { title: 'Residential Plot — 200 sqyd', description: 'Corner plot in a gated layout, clear title, ready to build.',
      location: { address: 'Sector 89, Plot 12', city: 'gurugram', state: 'Haryana' }, size: 200, sizeUnit: 'sqyd',
      originalPrice: 8000000, discountPercent: 0, photos: [IMG.plot], status: PROPERTY_STATUS.APPROVED },
    { title: 'Studio Apartment near IT Park', description: 'Compact studio, fully furnished, ideal first home.',
      location: { address: 'Unitech Cyber Park', city: 'gurugram', state: 'Haryana' }, size: 520, sizeUnit: 'sqft',
      originalPrice: 3500000, discountPercent: 10, photos: [IMG.apt], status: PROPERTY_STATUS.PENDING },
  ],
  vendor2: [
    { title: '2 BHK Apartment near Metro', description: 'Walk to metro, semi-furnished, east facing.',
      location: { address: 'Greenwood Residency, Block A', city: 'noida', state: 'Uttar Pradesh' }, size: 1100, sizeUnit: 'sqft',
      originalPrice: 6500000, discountPercent: 8, photos: [IMG.flat2], status: PROPERTY_STATUS.APPROVED },
    { title: 'Commercial Plot — 500 sqyd', description: 'Main-road facing commercial plot, high footfall.',
      location: { address: 'Sector 62, Block B', city: 'noida', state: 'Uttar Pradesh' }, size: 500, sizeUnit: 'sqyd',
      originalPrice: 22000000, discountPercent: 0, photos: [IMG.plot], status: PROPERTY_STATUS.IN_PROCESS },
  ],
  vendor3: [
    { title: 'Sea-View 4 BHK Villa', description: 'Premium villa with private garden and sea view.',
      location: { address: 'Palm Beach Road', city: 'mumbai', state: 'Maharashtra' }, size: 3200, sizeUnit: 'sqft',
      originalPrice: 48000000, discountPercent: 3, photos: [IMG.villa, IMG.flat], status: PROPERTY_STATUS.APPROVED, featured: true },
    { title: '1 BHK Budget Flat', description: 'Affordable starter flat, good connectivity.',
      location: { address: 'Andheri East', city: 'mumbai', state: 'Maharashtra' }, size: 600, sizeUnit: 'sqft',
      originalPrice: 9500000, discountPercent: 12, photos: [IMG.apt], status: PROPERTY_STATUS.REJECTED },
    { title: 'Farm Land — 1 acre', description: 'Fertile farm land near the highway, water source available.',
      location: { address: 'Karjat Outskirts', city: 'raigad', state: 'Maharashtra' }, size: 1, sizeUnit: 'acre',
      originalPrice: 7000000, discountPercent: 0, photos: [], status: PROPERTY_STATUS.PENDING },
  ],
}

async function upsertUser(u) {
  let existing = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] })
  if (existing) {
    console.log(`[skip]    ${u.email.padEnd(34)} role=${existing.role}`)
    return existing
  }
  existing = await User.create({
    username: u.username, email: u.email, passwordHash: u.password,
    displayName: u.displayName, role: u.role, moduleAccess: [],
  })
  console.log(`[created] ${u.email.padEnd(34)} role=${u.role}`)
  return existing
}

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set — copy .env.example to .env and fill it in')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB\n── Users ─────────────────────────────────')

  const byUsername = {}
  for (const u of USERS) byUsername[u.username] = await upsertUser(u)

  console.log('\n── Listings ──────────────────────────────')
  let plotCount = 0
  for (const [vname, plots] of Object.entries(PLOTS)) {
    const vendor = byUsername[vname]
    if (!vendor) continue
    for (const p of plots) {
      const exists = await Property.findOne({ title: p.title, vendorId: vendor._id })
      if (exists) { console.log(`[skip]    ${p.title}`); continue }
      await Property.create({ ...p, vendorId: vendor._id })
      console.log(`[created] ${p.title.padEnd(34)} ${p.status}  (${vname})`)
      plotCount++
    }
  }

  // ── Credentials summary ──────────────────────────────────────────────────────────
  console.log('\n════════════ LOGIN CREDENTIALS ════════════')
  const grouped = USERS.reduce((m, u) => ((m[u.role] ||= []).push(u), m), {})
  for (const role of ['super-admin', 'admin', 'vendor', 'user']) {
    console.log(`\n${role.toUpperCase()}`)
    for (const u of grouped[role] || []) {
      console.log(`  ${u.email.padEnd(34)} | ${u.password.padEnd(12)} | ${u.displayName}`)
    }
  }
  console.log(`\nSeeded ${USERS.length} users and ${plotCount} new listings.`)
  console.log('Tip: log in as a super-admin to see the Users tab in the dashboard.\n')

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
