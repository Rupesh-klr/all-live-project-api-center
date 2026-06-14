const mongoose = require('mongoose')

/**
 * Active token collection.
 * Every login creates a new record. Logout marks isActive=false.
 * Auth middleware checks isActive before allowing access.
 */
const tokenSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accessToken:  { type: String, required: true, index: true },
  refreshToken: { type: String, required: true, unique: true },
  isActive:     { type: Boolean, default: true, index: true },
  ipAddress:    { type: String },
  userAgent:    { type: String },
  accessExpiresAt:  { type: Date, required: true },
  refreshExpiresAt: { type: Date, required: true },
}, { timestamps: true })

// Auto-expire documents 1 day after refresh token expires
tokenSchema.index({ refreshExpiresAt: 1 }, { expireAfterSeconds: 86400 })

module.exports = mongoose.model('Token', tokenSchema)
