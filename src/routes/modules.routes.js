const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const { ok } = require('../utils/response')

const router = Router()

/**
 * @swagger
 * /api/modules:
 *   get:
 *     tags: [System]
 *     summary: Returns all active modules with their meta (used by the login page banner)
 */
router.get('/', (req, res) => {
  const modulesDir = path.join(__dirname, '../modules')
  const modules = []

  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const appFile = path.join(modulesDir, entry.name, 'app.js')
    if (!fs.existsSync(appFile)) continue
    try {
      const mod = require(appFile)
      if (mod.meta?.active) modules.push(mod.meta)
    } catch { /* skip broken modules */ }
  }

  return ok(res, { modules }, 'Active modules')
})

module.exports = router
