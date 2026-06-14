const mongoose = require('mongoose')
const logger = require('../utils/logger')

/**
 * Returns a plain-English explanation for every common MongoDB connection error.
 * Used so developers can fix issues without reading raw driver error messages.
 */
function diagnose(err, uri) {
  const msg = err.message || ''
  const isAtlas = uri && uri.includes('mongodb+srv')
  const isLocal = uri && uri.includes('localhost')

  // ── DNS / SRV lookup failure ───────────────────────────────────────────────
  if (/querySrv.*ECONNREFUSED|querySrv.*ENOTFOUND|ENOTFOUND/i.test(msg)) {
    return [
      'DNS lookup failed for the MongoDB cluster hostname.',
      isAtlas
        ? 'For MongoDB Atlas — check these:'
        : 'Check these:',
      '  1. Is your internet / VPN connection active?',
      '  2. Open Atlas → Clusters → copy the exact connection string again.',
      '     The cluster URL in .env must match exactly (e.g. cluster0.yqddfnu.mongodb.net).',
      '  3. If the cluster was just created, DNS can take 1–2 minutes to propagate.',
    ].join('\n')
  }

  // ── TCP connection refused (local) ─────────────────────────────────────────
  if (/ECONNREFUSED/i.test(msg) && isLocal) {
    return [
      'Connection refused — local MongoDB is not running.',
      'Start it with:',
      '  mongod                          # default data path',
      '  mongod --dbpath /path/to/data   # custom data path',
      'Or start the MongoDB service:',
      '  net start MongoDB               # Windows',
      '  sudo systemctl start mongod     # Linux',
      '  brew services start mongodb-community  # macOS',
    ].join('\n')
  }

  // ── Authentication failure ─────────────────────────────────────────────────
  if (/bad auth|Authentication failed|AuthenticationFailed|not authorized/i.test(msg)) {
    return [
      'Authentication failed — wrong username or password.',
      isAtlas
        ? 'For MongoDB Atlas — check these:'
        : 'Check these:',
      '  1. Atlas → Database Access → confirm the username and password.',
      '  2. If your password contains special characters (space, @, #, $, +)',
      '     they must be URL-encoded in the connection string:',
      '       space → %20    @ → %40    # → %23    $ → %24    + → %2B',
      '     Example: "my pass@word" → "my%20pass%40word"',
      '  3. Confirm the user has readWrite (or Atlas Admin) role on the correct database.',
    ].join('\n')
  }

  // ── Server selection timeout (Atlas IP whitelist is the most common cause) ─
  if (/Server selection timed out|MongoServerSelectionError|ETIMEDOUT/i.test(msg)) {
    return [
      'Server selection timed out — the server is reachable by DNS but not accepting the TCP connection.',
      isAtlas
        ? 'For MongoDB Atlas — the most common cause is IP whitelist:'
        : 'Check these:',
      '  1. Atlas → Network Access → add your current IP address.',
      '     To allow all IPs (dev only, not for production): 0.0.0.0/0',
      '  2. If you are behind a VPN or corporate proxy, the VPN exit IP must be whitelisted.',
      '  3. Check that the cluster is not paused (Atlas pauses free clusters after 60 days).',
      '     Atlas → Clusters → Resume if paused.',
    ].join('\n')
  }

  // ── Invalid connection string / parse error ────────────────────────────────
  if (/Invalid scheme|MongoParseError|Invalid connection string|must begin with/i.test(msg)) {
    return [
      'Invalid MongoDB connection string format.',
      'Atlas format:  mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority',
      'Local format:  mongodb://localhost:27017/<db>',
      'Common mistakes:',
      '  • Missing "mongodb+srv://" or "mongodb://" prefix',
      '  • Password contains unencoded special characters (space, @, #)',
      '  • Extra space or newline in the MONGO_URI value in .env',
    ].join('\n')
  }

  // ── MONGO_URI missing ──────────────────────────────────────────────────────
  if (/MONGO_URI is not defined/i.test(msg)) {
    return [
      'MONGO_URI is not set.',
      'Copy .env.example to .env and fill in your connection string:',
      '  cp .env.example .env',
    ].join('\n')
  }

  // ── Topology destroyed (server shut down while connected) ─────────────────
  if (/Topology was destroyed/i.test(msg)) {
    return [
      'MongoDB connection was forcibly closed.',
      'This happens when the process receives SIGTERM/SIGKILL while queries are running.',
      'If you see this on startup, a previous process may not have exited cleanly.',
      'Restart the server: npm run dev',
    ].join('\n')
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return [
    'Unexpected MongoDB error — raw message:',
    `  ${msg}`,
    'Troubleshooting steps:',
    '  1. Double-check MONGO_URI in your .env file.',
    '  2. Confirm your network / VPN is active.',
    '  3. For Atlas: check Network Access and Database Access in the Atlas dashboard.',
  ].join('\n')
}

async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    const hint = diagnose({ message: 'MONGO_URI is not defined' }, uri)
    throw new Error(`MONGO_URI is not defined in environment.\n${hint}`)
  }

  mongoose.connection.on('connected', () =>
    logger.info('MongoDB connected')
  )

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — will attempt to reconnect automatically')
  })

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB runtime error: ${err.message}`)
    logger.error(diagnose(err, uri))
  })

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  } catch (err) {
    const hint = diagnose(err, uri)
    logger.error('──────────────────────────────────────────────────────')
    logger.error('MongoDB connection FAILED')
    logger.error(`Raw error : ${err.message}`)
    logger.error('──────────────────────────────────────────────────────')
    logger.error(hint)
    logger.error('──────────────────────────────────────────────────────')
    throw err  // let server.js catch it and exit
  }
}

module.exports = { connectDB }
