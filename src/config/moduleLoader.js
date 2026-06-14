const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')

/**
 * Scans src/modules/ for directories containing app.js.
 * Each app.js MUST export: { router, meta }
 *   meta: { name, version, description, active }
 * If active === false the module is skipped — the server never loads it.
 * Mount path: /api/<module-name>/v1/
 */
function loadModules(app) {
  const modulesDir = path.join(__dirname, '../modules')
  const entries = fs.readdirSync(modulesDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const appFile = path.join(modulesDir, entry.name, 'app.js')
    if (!fs.existsSync(appFile)) {
      logger.warn(`[ModuleLoader] Skipping ${entry.name} — no app.js found`)
      continue
    }

    try {
      const mod = require(appFile)
      if (!mod.meta?.active) {
        logger.info(`[ModuleLoader] Module "${entry.name}" is inactive — skipped`)
        continue
      }
      const mountPath = `/api/${entry.name}/v1`
      app.use(mountPath, mod.router)
      logger.info(`[ModuleLoader] Mounted "${entry.name}" at ${mountPath}`)
    } catch (err) {
      logger.error(`[ModuleLoader] Failed to load module "${entry.name}": ${err.message}`)
    }
  }
}

module.exports = { loadModules }
