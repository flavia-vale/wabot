import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SHA_PATTERN = /^[0-9a-f]{7,64}$/i

export function sanitizeDeploymentRevision(value) {
  const revision = String(value || '').trim()
  return SHA_PATTERN.test(revision) ? revision.toLowerCase().slice(0, 12) : null
}

/** Resolves conclusive revision evidence once at API boot; never infers deploys from restarts. */
export async function resolveDeploymentRevision({ env = process.env, cwd = process.cwd(), run = execFileAsync } = {}) {
  for (const key of ['WABOT_GIT_SHA', 'GIT_SHA', 'SOURCE_VERSION']) {
    const revision = sanitizeDeploymentRevision(env[key])
    if (revision) return revision
  }
  try {
    const { stdout } = await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd, timeout: 2000 })
    return sanitizeDeploymentRevision(stdout)
  } catch {
    return null
  }
}
