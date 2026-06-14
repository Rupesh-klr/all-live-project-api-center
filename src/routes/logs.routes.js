const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const { ok, unauthorized, badRequest } = require('../utils/response')

const router = Router()
const LOG_DIR = path.join(__dirname, '../../logs')

// 24-char key guard
function guardKey(req, res, next) {
  const key = req.headers['x-log-key'] || req.query.key
  const expected = process.env.LOG_ACCESS_KEY
  if (!expected || key !== expected) return unauthorized(res, 'Invalid log access key')
  next()
}

/**
 * @swagger
 * /api/logs/files:
 *   get:
 *     tags: [Logs]
 *     summary: List available log files (requires X-Log-Key header)
 */
router.get('/files', guardKey, (req, res) => {
  if (!fs.existsSync(LOG_DIR)) return ok(res, { files: [] }, 'No logs yet')
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const stat = fs.statSync(path.join(LOG_DIR, f))
      return { name: f, size: stat.size, modified: stat.mtime }
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified))
  return ok(res, { files }, 'Log files')
})

/**
 * @swagger
 * /api/logs/view:
 *   get:
 *     tags: [Logs]
 *     summary: Read a log file with pagination or tail mode
 *     parameters:
 *       - in: query
 *         name: file
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: tail
 *         schema: { type: boolean }
 *         description: "If true, returns the last 'limit' lines (like tail -f)"
 */
router.get('/view', guardKey, (req, res) => {
  const { file, tail, page = '1', limit = '100' } = req.query
  if (!file) return badRequest(res, 'file query param required')

  const safeName = path.basename(file)
  const filePath = path.join(LOG_DIR, safeName)
  if (!fs.existsSync(filePath)) return badRequest(res, 'File not found')

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n').filter(Boolean)

  if (tail === 'true') {
    const n = Math.min(parseInt(limit, 10), 500)
    return ok(res, { lines: lines.slice(-n), total: lines.length, mode: 'tail' }, 'Tail log')
  }

  const pageNum = Math.max(1, parseInt(page, 10))
  const limitNum = Math.min(parseInt(limit, 10), 500)
  const start = (pageNum - 1) * limitNum
  const slice = lines.slice(start, start + limitNum)

  return ok(res, {
    lines: slice,
    page: pageNum,
    limit: limitNum,
    total: lines.length,
    totalPages: Math.ceil(lines.length / limitNum),
  }, 'Log page')
})

module.exports = router
