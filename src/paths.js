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

// Fora do auth_info de propósito: o auth_info entra no backup diário.
export function getSentMessagesDir(userId) {
  return resolve(getLogsBaseDir(), 'sent-messages', String(userId))
}

export function getKnownChannelsFile(userId) {
  return resolve(getLogsBaseDir(), `known_channels_${String(userId)}.json`)
}
