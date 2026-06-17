const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

/**
 * ISOLATED user collection for the Profilo builder ("profile_users").
 * Separate from the shared `users` collection / `/api/auth/v1` so builder
 * signups can NEVER affect the main app's auth.
 *
 * Identity is the USERNAME (unique). Email is OPTIONAL and intentionally NOT
 * unique — duplicate emails are allowed.
 */
const profileUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, default: '', trim: true, lowercase: true }, // duplicates allowed
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
