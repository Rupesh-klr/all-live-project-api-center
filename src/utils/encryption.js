const CryptoJS = require('crypto-js')

const PREFIX = 'ENCRY_MIDDLE_PROTECTION:'

/**
 * Decrypts a value that was encrypted by the frontend using the same AES passphrase.
 * Frontend must prefix with ENCRY_MIDDLE_PROTECTION: before encrypting.
 */
function decrypt(ciphertext) {
  const key = process.env.ENCRY_MIDDLE_KEY
  if (!key) throw new Error('ENCRY_MIDDLE_KEY not configured')
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  const result = bytes.toString(CryptoJS.enc.Utf8)
  if (!result) throw new Error('Decryption failed — possible wrong key or corrupted payload')
  return result
}

/**
 * Recursively scans req.body / req.query / req.params for ENCRY_MIDDLE_PROTECTION: prefixed values
 * and replaces them in-place with the decrypted plaintext.
 */
function decryptRequestFields(obj) {
  if (!obj || typeof obj !== 'object') return
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (typeof val === 'string' && val.startsWith(PREFIX)) {
      obj[key] = decrypt(val.slice(PREFIX.length))
    } else if (typeof val === 'object') {
      decryptRequestFields(val)
    }
  }
}

module.exports = { decrypt, decryptRequestFields, PREFIX }
