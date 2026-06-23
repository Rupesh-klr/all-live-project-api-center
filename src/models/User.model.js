const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  email:       { type: String, required: true, unique: true, trim: true, lowercase: true },
  phoneNumber: { type: String, unique: true, sparse: true, trim: true },
  // Password stored as bcrypt hash — NEVER stored raw
  passwordHash: { type: String, required: true, select: false },
  // Global role set, shared across all modules.
  //   super-admin / admin / vendor / user  → real-estate module
  //   manager / viewer / guest             → other portfolio modules (kept for back-compat)
  role:        { type: String, enum: ['super-admin', 'admin', 'manager', 'vendor', 'user', 'viewer', 'guest'], default: 'user' },
  // Which modules this user can access. Empty array = all modules.
  moduleAccess: { type: [String], default: [] },
  isActive:    { type: Boolean, default: true },
  lastLogin:   { type: Date },
  displayName: { type: String },
  avatarUrl:   { type: String },
  // Guest expiry — null for permanent users.
  // MongoDB TTL index auto-deletes the document when expiresAt is reached.
  expiresAt:   { type: Date, default: null },
}, { timestamps: true })

// TTL index: delete document when current time >= expiresAt
// Documents where expiresAt is null are never deleted by this index.
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  const salt = await bcrypt.genSalt(12)
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  next()
})

// Compare plaintext password to stored hash
userSchema.methods.comparePassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash)
}

// Remove hash from JSON output always
userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.passwordHash; return ret }
})

module.exports = mongoose.model('User', userSchema)
