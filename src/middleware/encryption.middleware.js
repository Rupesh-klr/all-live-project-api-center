const { decryptRequestFields } = require('../utils/encryption')
const logger = require('../utils/logger')

/**
 * Intercepts any request body/query field prefixed with ENCRY_MIDDLE_PROTECTION:
 * and replaces it with the decrypted plaintext before the controller sees it.
 * Works for body, query params, and route params.
 */
function encryptionMiddleware(req, res, next) {
  try {
    if (req.body) decryptRequestFields(req.body)
    if (req.query) decryptRequestFields(req.query)
  } catch (err) {
    logger.warn(`Encryption middleware: decryption failed — ${err.message}`, { url: req.originalUrl })
    return res.status(400).json({ success: false, message: 'Invalid encrypted payload' })
  }
  next()
}

module.exports = { encryptionMiddleware }
