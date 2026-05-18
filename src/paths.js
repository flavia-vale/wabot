import { resolve } from 'path'

function resolveFromEnv(envName, fallback) {
  return resolve(process.env[envName] || fallback)
}

export function getAuthInfoBaseDir() {
  return resolveFromEnv('AUTH_INFO_DIR', './auth_info')
}

export function getAuthInfoDir(userId) {
  return resolve(getAuthInfoBaseDir(), String(userId))
}

export function getLogsBaseDir() {
  return resolveFromEnv('BOT_LOG_DIR', './logs')
}

export function getDedupFile(userId) {
  return resolve(getLogsBaseDir(), `dedup_${String(userId)}.json`)
}

export function getKnownChannelsFile(userId) {
  return resolve(getLogsBaseDir(), `known_channels_${String(userId)}.json`)
}
