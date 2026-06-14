require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const { connectDB } = require('./src/config/db')
const { setupSwagger } = require('./src/config/swagger')
const { loadModules } = require('./src/config/moduleLoader')
const { corsMiddleware } = require('./src/middleware/cors.middleware')
const { rateLimiter } = require('./src/middleware/rateLimiter.middleware')
const { accessControl } = require('./src/middleware/accessControl.middleware')
const { botProtection } = require('./src/middleware/botProtection.middleware')
const { encryptionMiddleware } = require('./src/middleware/encryption.middleware')
const logsRoutes = require('./src/routes/logs.routes')
const modulesRoutes = require('./src/routes/modules.routes')
const logger = require('./src/utils/logger')

const app = express()
const PORT = process.env.PORT || 5000

// Security headers
app.use(helmet())
app.set('trust proxy', 1)

// CORS — allows configured origins and all subdomains of mainDomain
app.use(corsMiddleware)

// Global rate limit
app.use(rateLimiter)

// IP / host whitelist (no-op when env vars are empty)
app.use(accessControl)

// Block bots and no-UA requests
app.use(botProtection)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Decrypt ENCRY_MIDDLE_PROTECTION: prefixed fields in body/query
app.use(encryptionMiddleware)

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() })
)

// Module registry for login-page banner
app.use('/api/modules', modulesRoutes)

// Log viewer (X-Log-Key protected)
app.use('/api/logs', logsRoutes)

// Dynamically mount all active modules at /api/<name>/v1
loadModules(app)

// Swagger UI
setupSwagger(app)

// 404
app.use((req, res) => {
  logger.warn(`404: ${req.method} ${req.originalUrl}`, { ip: req.ip })
  res.status(404).json({ success: false, message: 'Endpoint not found' })
})

// Global error handler
app.use((err, req, res, _next) => {
  logger.error(`Unhandled: ${err.message}`, { stack: err.stack, url: req.originalUrl })
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`✓ Server running → http://localhost:${PORT}`)
    logger.info(`✓ Swagger UI    → http://localhost:${PORT}/api-docs`)
  })
}).catch(err => {
  logger.error(`DB connection failed: ${err.message}`)
  process.exit(1)
})
