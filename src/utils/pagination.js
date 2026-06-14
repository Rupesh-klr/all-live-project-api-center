const { pagination } = require('../config/app.config')

/**
 * Shared pagination helpers — used by every module so paging behaves identically
 * across the whole API.
 *
 *   const { page, limit, skip } = parsePagination(req)        // from ?page=&limit=
 *   const meta = buildPageMeta({ page, limit, total })        // for the response
 *   const slice = paginate(array, { page, limit })            // for in-memory data
 *
 * For Mongo: pass `skip` + `limit` to the query, count the total, then buildPageMeta.
 */
function parsePagination(req, opts = {}) {
  const defaultLimit = opts.defaultLimit ?? pagination.defaultLimit
  const maxLimit = opts.maxLimit ?? pagination.maxLimit

  let page = parseInt(req.query.page, 10)
  if (!Number.isFinite(page) || page < 1) page = 1

  let limit = parseInt(req.query.limit, 10)
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  return { page, limit, skip: (page - 1) * limit }
}

function buildPageMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

function paginate(array = [], { page, limit }) {
  const start = (page - 1) * limit
  return array.slice(start, start + limit)
}

module.exports = { parsePagination, buildPageMeta, paginate }
