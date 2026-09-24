export const CREDENTIAL_RULES_VERSION = 'amazon-tag-only-v2'

function normalizeStartedAt(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}

function resolveGitSha(env = process.env) {
  return env.WABOT_GIT_SHA || env.GIT_SHA || env.VERCEL_GIT_COMMIT_SHA || env.SOURCE_VERSION || 'unknown'
}

export function buildWorkerMetadata({
  userId = process.env.BOT_USER_ID || null,
  startedAt = Date.now(),
  gitSha = resolveGitSha(),
  pid = process.pid,
  ppid = process.ppid,
  cwd = process.cwd(),
  nodeVersion = process.version,
} = {}) {
  return {
    userId,
    pid,
    ppid,
    startedAt: normalizeStartedAt(startedAt),
    gitSha: gitSha || 'unknown',
    cwd,
    nodeVersion,
    credentialRulesVersion: CREDENTIAL_RULES_VERSION,
  }
}
