const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth.middleware')
const { authLimiter } = require('../../middleware/rateLimiter.middleware')
const ctrl = require('./auth.controller')

const router = Router()

// Public (rate-limited)
router.post('/login',    authLimiter, ctrl.login)
router.post('/register', authLimiter, ctrl.register)
router.post('/guest',    authLimiter, ctrl.guest)
router.post('/refresh',  authLimiter, ctrl.refresh)

// Protected
router.post('/logout', authMiddleware, ctrl.logout)
router.get('/me',      authMiddleware, ctrl.me)

const meta = {
  name: 'auth',
  version: 'v1',
  description: 'Shared authentication — login, register, guest session, token management',
  active: true,
  tech: ['JWT', 'bcrypt', 'MongoDB'],
  highlights: [
    '3-factor login (username / email / phone)',
    'AES-256 password encryption in transit',
    'Active token revocation via DB collection',
    'Guest sessions — auto-deleted after 7 days',
  ],
  defaultUsers: [
    { username: 'admin',  role: 'admin',  description: 'System administrator — admin@gmail.com / admin@123' },
    { username: 'viewer', role: 'viewer', description: 'Read-only access — viewer@portfolio.hub / viewer@123' },
  ],
}

module.exports = { router, meta }
