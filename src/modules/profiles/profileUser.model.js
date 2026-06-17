const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

/**
 * ISOLATED user collection for the Profilo builder.
 *
 * Intentionally SEPARATE from the shared `users` collection (src/models/User.model.js)
 * and the `/api/auth/v1` module, so profile-builder signups can NEVER affect the main
 * app's auth/users. Collection name: "profile_users".
 */
const profileUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // bcrypt hash — never stored raw, never selected by default
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'profile_users' }
)

profileUserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  const salt = await bcrypt.genSalt(12)
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  next()
})

profileUserSchema.methods.comparePassword = function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash)
}

profileUserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash
    return ret
  },
})

module.exports = mongoose.model('ProfileUser', profileUserSchema)
