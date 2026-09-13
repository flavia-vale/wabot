import { createHash, randomBytes } from 'node:crypto'
import { decryptCredential, encryptCredential } from '../../credentialCrypto.js'
import { getPlanAccess } from '../../billing/plans.js'
import { buildInstagramAuthorizationUrl } from './config.js'

const hash = value => createHash('sha256').update(value).digest('hex')

export async function beginInstagramOAuth(userId, config, { db, now = () => new Date() } = {}) {
  const { entitlements } = await getPlanAccess(userId, { db, now: now().getTime() })
  if (!entitlements.canUseInstagramStories) throw Object.assign(new Error('Requer plano acima do Pro'), { code: 'FEATURE_REQUIRES_PREMIUM' })
  const state = randomBytes(32).toString('base64url')
  await db.instagramOAuthState.create({ data: { userId, stateHash: hash(state), loginMethod: config.loginMethod, redirectUri: config.redirectUri, expiresAt: new Date(now().getTime() + 10 * 60_000) } })
  return { url: buildInstagramAuthorizationUrl(config, state) }
}

export async function listInstagramConnections(userId, { db } = {}) {
  return db.instagramConnection.findMany({ where: { userId }, select: { id: true, instagramAccountId: true, username: true, accountType: true, loginMethod: true, scopesJson: true, tokenExpiresAt: true, lastValidatedAt: true, lastRefreshedAt: true, status: true, lastErrorCode: true, lastErrorAt: true, createdAt: true, updatedAt: true, destinations: { select: { id: true, name: true, enabled: true } } }, orderBy: { createdAt: 'desc' } })
}

export async function disconnectInstagram(userId, connectionId, { db, now = () => new Date() } = {}) {
  return db.$transaction(async tx => {
    const changed = await tx.instagramConnection.updateMany({ where: { id: connectionId, userId }, data: { status: 'disconnected', encryptedToken: encryptCredential(''), lastErrorCode: null, lastErrorAt: now() } })
    if (!changed.count) throw Object.assign(new Error('Conexão Instagram não encontrada'), { code: 'NOT_FOUND' })
    await tx.destination.updateMany({ where: { userId, instagramConnectionId: connectionId }, data: { enabled: false } })
    return { ok: true }
  })
}

export async function refreshInstagramConnection(userId, connectionId, config, { db, client, now = () => new Date() } = {}) {
  const { entitlements } = await getPlanAccess(userId, { db, now: now().getTime() })
  if (!entitlements.canUseInstagramStories) throw Object.assign(new Error('Requer plano acima do Pro'), { code: 'FEATURE_REQUIRES_PREMIUM' })
  const row = await db.instagramConnection.findFirst({ where: { id: connectionId, userId, status: 'connected' } })
  if (!row) throw Object.assign(new Error('Conexão Instagram não encontrada'), { code: 'NOT_FOUND' })
  const token = decryptCredential(row.encryptedToken)
  if (!token || token.startsWith('v1:')) throw Object.assign(new Error('Credencial Instagram indisponível'), { code: 'INVALID_CREDENTIAL' })
  try {
    const refreshed = await client.refresh(token)
    const accessToken = refreshed.access_token || token
    await client.profile(accessToken)
    const expiresAt = refreshed.expires_in ? new Date(now().getTime() + Number(refreshed.expires_in) * 1000) : row.tokenExpiresAt
    await db.instagramConnection.update({ where: { id: row.id }, data: { encryptedToken: encryptCredential(accessToken), tokenExpiresAt: expiresAt, lastValidatedAt: now(), lastRefreshedAt: now(), lastErrorCode: null, lastErrorAt: null } })
    return { ok: true, tokenExpiresAt: expiresAt }
  } catch (error) {
    const status = error.retryable ? 'connected' : 'needs_reconnect'
    await db.instagramConnection.update({ where: { id: row.id }, data: { status, lastErrorCode: error.code || 'META_OAUTH_FAILED', lastErrorAt: now() } })
    if (!error.retryable) await db.destination.updateMany({ where: { userId, instagramConnectionId: row.id }, data: { enabled: false } })
    throw error
  }
}

export async function completeInstagramOAuth({ code, state }, config, { db, client, now = () => new Date() } = {}) {
  const stateHash = hash(String(state || ''))
  const consumedAt = now()
  const claimed = await db.instagramOAuthState.updateMany({ where: { stateHash, consumedAt: null, expiresAt: { gt: consumedAt }, loginMethod: config.loginMethod, redirectUri: config.redirectUri }, data: { consumedAt } })
  if (claimed.count !== 1) throw Object.assign(new Error('OAuth state inválido ou expirado'), { code: 'INVALID_OAUTH_STATE' })
  const row = await db.instagramOAuthState.findUnique({ where: { stateHash } })
  const { entitlements } = await getPlanAccess(row.userId, { db, now: now().getTime() })
  if (!entitlements.canUseInstagramStories) throw Object.assign(new Error('Requer plano acima do Pro'), { code: 'FEATURE_REQUIRES_PREMIUM' })
  const short = await client.exchangeCode(code)
  const long = await client.exchangeLongLived(short.access_token)
  const profile = await client.profile(long.access_token)
  const accountId = String(profile.user_id || profile.id)
  const expiresAt = long.expires_in ? new Date(now().getTime() + Number(long.expires_in) * 1000) : null
  return db.$transaction(async tx => {
    const connection = await tx.instagramConnection.upsert({ where: { userId_instagramAccountId: { userId: row.userId, instagramAccountId: accountId } }, create: { userId: row.userId, instagramAccountId: accountId, username: profile.username, accountType: profile.account_type, loginMethod: config.loginMethod, encryptedToken: encryptCredential(long.access_token), scopesJson: JSON.stringify(config.scopes), tokenIssuedAt: now(), tokenExpiresAt: expiresAt }, update: { username: profile.username, accountType: profile.account_type, encryptedToken: encryptCredential(long.access_token), scopesJson: JSON.stringify(config.scopes), tokenIssuedAt: now(), tokenExpiresAt: expiresAt, status: 'connected', lastErrorCode: null, lastErrorAt: null } })
    await tx.destination.upsert({ where: { userId_type_providerRef: { userId: row.userId, type: 'instagram_story', providerRef: accountId } }, create: { userId: row.userId, type: 'instagram_story', name: `Instagram @${profile.username || accountId}`, providerRef: accountId, instagramConnectionId: connection.id }, update: { name: `Instagram @${profile.username || accountId}`, instagramConnectionId: connection.id, enabled: true } })
    return { connectionId: connection.id, accountId, username: profile.username }
  })
}
