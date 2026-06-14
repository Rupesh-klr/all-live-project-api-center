const ok = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data })

const created = (res, data = null, message = 'Created') =>
  res.status(201).json({ success: true, message, data })

// Paginated list response. `meta` comes from utils/pagination.buildPageMeta().
const paginated = (res, items = [], meta = {}, message = 'Success') =>
  res.status(200).json({ success: true, message, data: items, pagination: meta })

const badRequest = (res, message = 'Bad request', errors = null) =>
  res.status(400).json({ success: false, message, errors })

const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message })

const forbidden = (res, message = 'Forbidden') =>
  res.status(403).json({ success: false, message })

const notFound = (res, message = 'Not found') =>
  res.status(404).json({ success: false, message })

const conflict = (res, message = 'Conflict') =>
  res.status(409).json({ success: false, message })

const serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ success: false, message })

module.exports = { ok, created, paginated, badRequest, unauthorized, forbidden, notFound, conflict, serverError }
