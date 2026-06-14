/**
 * Global backend configuration — env-driven, with safe defaults.
 *
 * Identity mirrors the frontend `src/config/app.config.js` so the API's `/info`
 * style responses can carry the same branding. Pagination defaults are shared by
 * every module through `utils/pagination.js`.
 */
const num = (v, fallback) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

module.exports = {
  identity: {
    brandName:      process.env.BRAND_NAME       || 'portfolio.hub',
    developerName:  process.env.DEVELOPER_NAME   || 'Rupesh',
    developerTitle: process.env.DEVELOPER_TITLE  || 'Full-Stack Engineer',
    tagline:        process.env.PORTFOLIO_TAGLINE || 'Production-grade engineering',
    experience:     process.env.PORTFOLIO_EXPERIENCE || '',
    contactEmail:   process.env.CONTACT_EMAIL || '',
  },

  pagination: {
    defaultLimit: num(process.env.PAGINATION_DEFAULT_LIMIT, 10),
    maxLimit:     num(process.env.PAGINATION_MAX_LIMIT, 100),
  },
}
