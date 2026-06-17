const mongoose = require('mongoose')

/**
 * One "page" inside a profile site (the renderer reads `json` = { person, nav,
 * ui, sections[], footer }). A profile can hold many pages up to its plan limit.
 */
const pageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true }, // '' or 'home' = root page
    title: { type: String, default: '' },
    template: { type: String, default: 'profile-1' }, // which Profile/Team variant
    json: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
)

/**
 * A published profile site, addressed by its unique top-level `slug`
 * (e.g. "rupesh" → GET /api/profiles/v1/rupesh → rupesh's JSON).
 * Ownership is per-profile: either a logged-in user (ownerUserId, JWT) OR a
 * one-time secret editKey (hashed) returned at creation.
 */
const profileSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    displayName: { type: String, default: '' },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    editKeyHash: { type: String, required: true },
    plan: { type: String, enum: ['free', 'advanced'], default: 'free', index: true },
    planExpiresAt: { type: Date, default: null },
    published: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // brand-level (person, theme, palette…)
    pages: { type: [pageSchema], default: [] },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
)

profileSchema.virtual('pageCount').get(function () {
  return Array.isArray(this.pages) ? this.pages.length : 0
})

module.exports = mongoose.model('Profile', profileSchema)
