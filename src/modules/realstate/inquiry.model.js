const mongoose = require('mongoose')

/**
 * A conversation thread between a buyer (user) and a vendor about one property.
 *
 * Messaging is capped: a user may send MSG_LIMITS.user messages and a vendor
 * MSG_LIMITS.vendor replies. Once exhausted, `approvalRequired` flips true and
 * further messages are rejected until an admin/super-admin approves the thread.
 */
const messageSchema = new mongoose.Schema(
  {
    senderRole: { type: String, required: true }, // 'user' | 'vendor'
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
)

const inquirySchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    messages: { type: [messageSchema], default: [] },

    userMessageCount: { type: Number, default: 0 },
    vendorReplyCount: { type: Number, default: 0 },

    // Frozen until an admin approves continuation.
    approvalRequired: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// One thread per (property, user) pair.
inquirySchema.index({ propertyId: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model('Inquiry', inquirySchema)
