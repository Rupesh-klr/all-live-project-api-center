const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const logger = require('../../utils/logger')
const Profile = require('./profile.model')

/**
 * Optional background sync: periodically export every profile to
 * <repo>/profiles/<slug>.json and commit + push to the repo — a file-based,
 * version-controlled backup of all JSON.
 *
 * DISABLED by default. Enable in .env:
 *   PROFILE_GIT_SYNC=true
 *   PROFILE_GIT_DIR=...      either a LOCAL checked-out repo path,
 *                            OR a remote URL (https://github.com/u/repo) — it is
 *                            auto-cloned into a cache dir and pushed.
 *   PROFILE_GIT_TOKEN=...    GitHub token (required to push to an https URL)
 *   PROFILE_GIT_BRANCH=main  (optional)
 *   PROFILE_GIT_SYNC_MINUTES=15 (optional)
 *   PROFILE_GIT_CACHE=...    (optional) where to clone URL repos; default os tmp
 *   PROFILE_GIT_EMAIL / PROFILE_GIT_NAME  (optional commit identity)
 *
 * Uses setInterval (no extra dependency). Safe no-op when disabled/misconfigured.
 */
const isUrl = (s) => /^(https?:\/\/|git@)/.test(s || '')

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || err.message || '').trim())) : resolve(stdout)
    )
  })
}

/** Inject a token into an https remote so clone/push can authenticate. */
function authUrl(url) {
  const token = process.env.PROFILE_GIT_TOKEN
  if (token && url.startsWith('https://')) {
    return url.replace('https://', `https://${encodeURIComponent(token)}@`)
  }
  return url
}

/**
 * Returns a local working dir for the repo:
 *  • local path  → used as-is (must contain .git)
 *  • remote URL  → cloned (or pulled) into a cache dir
 */
async function resolveRepoDir() {
  const configured = process.env.PROFILE_GIT_DIR
  if (!configured) return null
  const branch = process.env.PROFILE_GIT_BRANCH || 'main'

  if (!isUrl(configured)) {
    return fs.existsSync(path.join(configured, '.git')) ? configured : null
  }

  const cacheRoot = process.env.PROFILE_GIT_CACHE || path.join(os.tmpdir(), 'profilo-git-sync')
  const name = configured.replace(/\.git$/, '').split('/').pop() || 'repo'
  const dir = path.join(cacheRoot, name)

  if (fs.existsSync(path.join(dir, '.git'))) {
    await git(['remote', 'set-url', 'origin', authUrl(configured)], dir)
    try {
      await git(['pull', '--ff-only', 'origin', branch], dir)
    } catch (e) {
      logger.warn(`[profiles] git pull skipped: ${e.message}`)
    }
    return dir
  }

  fs.mkdirSync(cacheRoot, { recursive: true })
  logger.info(`[profiles] cloning ${configured} → ${dir}`)
  await git(['clone', '--depth', '1', '--branch', branch, authUrl(configured), dir], cacheRoot)
  return dir
}

async function ensureIdentity(dir) {
  try {
    await git(['config', 'user.email'], dir)
  } catch {
    await git(['config', 'user.email', process.env.PROFILE_GIT_EMAIL || 'profilo-bot@users.noreply.github.com'], dir)
  }
  try {
    await git(['config', 'user.name'], dir)
  } catch {
    await git(['config', 'user.name', process.env.PROFILE_GIT_NAME || 'Profilo Bot'], dir)
  }
}

async function exportAndPush(dir) {
  await ensureIdentity(dir)
  const outDir = path.join(dir, 'profiles')
  fs.mkdirSync(outDir, { recursive: true })

  const profiles = await Profile.find({}).lean()
  let changed = 0
  for (const p of profiles) {
    const file = path.join(outDir, `${p.slug}.json`)
    const payload = JSON.stringify(
      {
        slug: p.slug,
        displayName: p.displayName,
        plan: p.plan,
        published: p.published,
        meta: p.meta,
        pages: p.pages,
        updatedAt: p.updatedAt,
      },
      null,
      2
    )
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (prev !== payload) {
      fs.writeFileSync(file, payload)
      changed++
    }
  }

  if (!changed) {
    logger.info('[profiles] git sync — nothing changed')
    return
  }

  const branch = process.env.PROFILE_GIT_BRANCH || 'main'
  await git(['add', 'profiles'], dir)
  await git(['commit', '-m', `chore(profiles): sync ${changed} profile(s) [skip ci]`], dir)
  await git(['push', 'origin', branch], dir)
  logger.info(`[profiles] git sync pushed ${changed} profile(s) → origin/${branch}`)
}

function startProfileGitSync() {
  if (String(process.env.PROFILE_GIT_SYNC).toLowerCase() !== 'true') {
    logger.info('[profiles] git sync disabled (set PROFILE_GIT_SYNC=true to enable)')
    return
  }
  if (!process.env.PROFILE_GIT_DIR) {
    logger.warn('[profiles] PROFILE_GIT_DIR not set — git sync skipped')
    return
  }
  if (isUrl(process.env.PROFILE_GIT_DIR) &&
      process.env.PROFILE_GIT_DIR.startsWith('https://') &&
      !process.env.PROFILE_GIT_TOKEN) {
    logger.warn('[profiles] PROFILE_GIT_DIR is an https URL but PROFILE_GIT_TOKEN is not set — push will fail until a token is provided')
  }

  const intervalMin = Math.max(1, Number(process.env.PROFILE_GIT_SYNC_MINUTES || 15))
  const run = async () => {
    try {
      const dir = await resolveRepoDir()
      if (!dir) {
        logger.warn('[profiles] PROFILE_GIT_DIR is not a usable git repo/URL — skipped')
        return
      }
      await exportAndPush(dir)
    } catch (e) {
      logger.error(`[profiles] git sync failed: ${e.message}`)
    }
  }
  run()
  const timer = setInterval(run, intervalMin * 60 * 1000)
  timer.unref?.()
  logger.info(`[profiles] git sync ON — every ${intervalMin}m → ${process.env.PROFILE_GIT_DIR}`)
}

module.exports = { startProfileGitSync, exportAndPush }
