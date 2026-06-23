const mongoose = require('mongoose')
const { PROPERTY_STATUSES, PROPERTY_STATUS, SIZE_UNITS, MAX_PHOTOS } = require('./realstate.constants')

const URL_RE = /^https?:\/\/.+/i

/**
 * A single plot / flat listed by a vendor.
 * Listings start as `pending` and only become publicly visible once an
 * admin/super-admin migrates them to `approved`.
 */
const propertySchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', trim: true, maxlength: 4000 },

    // Location is mandatory (address required; city used for filtering).
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true, lowercase: true, index: true },
      state: { type: String, default: '', trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // Size is mandatory.
    size: { type: Number, required: true, min: 1 },
    sizeUnit: { type: String, enum: SIZE_UNITS, default: 'sqft' },

    // Pricing — original price mandatory; discount optional (percentage).
    originalPrice: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 90 },

    // Up to MAX_PHOTOS image URLs.
    photos: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr) => arr.length <= MAX_PHOTOS,
          message: `A listing may have at most ${MAX_PHOTOS} photos`,
        },
        {
          validator: (arr) => arr.every((u) => URL_RE.test(u)),
          message: 'Each photo must be a valid http(s) URL',
        },
      ],
    },

    status: { type: String, enum: PROPERTY_STATUSES, default: PROPERTY_STATUS.PENDING, index: true },
    statusNote: { type: String, default: '' }, // admin note on last status change
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Final price after discount — never persisted, always derived.
propertySchema.virtual('finalPrice').get(function () {
  const d = Math.min(Math.max(this.discountPercent || 0, 0), 90)
  return Math.round((this.originalPrice || 0) * (1 - d / 100))
})

propertySchema.set('toJSON', { virtuals: true })
propertySchema.set('toObject', { virtuals: true })

/**
 * Safe public projection. `full` exposes owner-only fields (vendor view / admin view).
 * Never leaks anything beyond what each audience should see.
 */
propertySchema.methods.toPublic = function ({ full = false } = {}) {
  const base = {
    id: this._id,
    title: this.title,
    description: this.description,
    location: this.location,
    size: this.size,
    sizeUnit: this.sizeUnit,
    originalPrice: this.originalPrice,
    discountPercent: this.discountPercent,
    finalPrice: this.finalPrice,
    photos: this.photos,
    featured: this.featured,
    createdAt: this.createdAt,
  }
  if (full) {
    base.status = this.status
    base.statusNote = this.statusNote
    base.views = this.views
    base.vendorId = this.vendorId
    base.updatedAt = this.updatedAt
  }
  return base
}

module.exports = mongoose.model('Property', propertySchema)
