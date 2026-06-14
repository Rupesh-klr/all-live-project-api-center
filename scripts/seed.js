/**
 * Seed script — creates default users in MongoDB.
 * Run once after DB is connected:
 *   node scripts/seed.js
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../src/models/User.model')

const USERS = [
  {
    username:    'admin',
    email:       'admin@gmail.com',
    password:    'admin@123',
    displayName: 'Admin',
    role:        'admin',
    moduleAccess: [],   // empty = access to all modules
  },
  {
    username:    'viewer',
    email:       'viewer@portfolio.hub',
    password:    'viewer@123',
    displayName: 'Viewer',
    role:        'viewer',
    moduleAccess: [],
  },
]

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set — copy .env.example to .env and fill in your connection string')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB\n')

  for (const data of USERS) {
    const exists = await User.findOne({ $or: [{ email: data.email }, { username: data.username }] })
    if (exists) {
      console.log(`[skip]    ${data.email}  (already exists as "${exists.username}")`)
      continue
    }
    await User.create({
      username:     data.username,
      email:        data.email,
      passwordHash: data.password,   // pre-save hook bcrypt-hashes this
      displayName:  data.displayName,
      role:         data.role,
      moduleAccess: data.moduleAccess,
    })
    console.log(`[created] ${data.email}  role=${data.role}`)
  }

  console.log('\nSeed complete.')
  await mongoose.disconnect()
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
