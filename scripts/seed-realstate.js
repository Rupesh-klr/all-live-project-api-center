/**
 * Real-estate seed — creates the role hierarchy + sample listings.
 * Run once after the DB is reachable:
 *   npm run seed:realstate
 *
 * Idempotent: existing users/properties are skipped.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../src/models/User.model')
const Property = require('../src/modules/realstate/property.model')
const { PROPERTY_STATUS } = require('../src/modules/realstate/realstate.constants')

const USERS = [
  { username: 'superadmin', email: 'superadmin@estatehub.example', password: 'Super@123',  displayName: 'Estate Owner',  role: 'super-admin' },
  { username: 'estateadmin', email: 'admin@estatehub.example',     password: 'Admin@123',  displayName: 'Estate Admin',  role: 'admin' },
  { username: 'vendor1',     email: 'vendor1@estatehub.example',   password: 'Vendor@123', displayName: 'Ravi Properties', role: 'vendor' },
  { username: 'buyer1',      email: 'buyer1@estatehub.example',    password: 'Buyer@123',  displayName: 'Sample Buyer',   role: 'user' },
]

const SAMPLE = (vendorId) => [
  {
    vendorId, title: '3 BHK Flat in Cyber Greens', description: 'Spacious 3BHK with modular kitchen, covered parking and clubhouse access.',
    location: { address: 'Tower C, Cyber Greens', city: 'gurugram', state: 'Haryana' },
    size: 1650, sizeUnit: 'sqft', originalPrice: 12500000, discountPercent: 5,
    photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'],
    status: PROPERTY_STATUS.APPROVED, featured: true,
  },
  {
    vendorId, title: 'Residential Plot — 200 sqyd', description: 'Corner plot in a gated layout, clear title, ready for construction.',
    location: { address: 'Sector 89, Plot 12', city: 'gurugram', state: 'Haryana' },
    size: 200, sizeUnit: 'sqyd', originalPrice: 8000000, discountPercent: 0,
    photos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef'],
    status: PROPERTY_STATUS.APPROVED,
  },
  {
    vendorId, title: '2 BHK Apartment near Metro', description: 'Walk to metro, semi-furnished, east facing.',
    location: { address: 'Greenwood Residency, Block A', city: 'noida', state: 'Uttar Pradesh' },
    size: 1100, sizeUnit: 'sqft', originalPrice: 6500000, discountPercent: 8,
    photos: [],
    status: PROPERTY_STATUS.PENDING,
  },
]

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set — copy .env.example to .env and fill it in')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB\n')

  let vendor
  for (const u of USERS) {
    let existing = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] })
    if (existing) {
      console.log(`[skip]    ${u.email} (exists as "${existing.username}", role=${existing.role})`)
    } else {
      existing = await User.create({
        username: u.username, email: u.email, passwordHash: u.password,
        displayName: u.displayName, role: u.role, moduleAccess: [],
      })
      console.log(`[created] ${u.email}  role=${u.role}`)
    }
    if (u.role === 'vendor') vendor = existing
  }

  if (vendor) {
    for (const p of SAMPLE(vendor._id)) {
      const exists = await Property.findOne({ title: p.title, vendorId: vendor._id })
      if (exists) { console.log(`[skip]    property "${p.title}"`); continue }
      await Property.create(p)
      console.log(`[created] property "${p.title}" (${p.status})`)
    }
  }

  console.log('\nReal-estate seed complete.')
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
