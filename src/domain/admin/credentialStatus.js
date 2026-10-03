// Status da chave de loja por cliente — decisão PURA (sem banco, sem rede).
//
// M6 da auditoria (docs/admin/auditoria-painel-admin.md): a sondagem diária
// (src/credentialExpiry/sweep.js) descobre chave vencida/recusada e avisa só a
// cliente por e-mail. Aqui a admin passa a ver o mesmo dado SEM sondagem nova:
// a fonte é o último AnalyticsEvent `credential_expiry_alert_sent` por
// (userId, loja).
//
// Limite honesto do dado: o evento só existe quando a sondagem CONFIRMOU
// problema. Não existe evento "está tudo bem". Logo, sem evento = "sem
// medição" (não "ok"). "ok" só aparece quando alguém passa o resultado de uma
// sondagem ao vivo (botão "Testar chave" da ficha).

import { ALERT_EVENT, EXPIRY_ALERT_PLATFORMS } from '../../credentialExpiry/policy.js'

export { ALERT_EVENT }

export const CREDENTIAL_STATUS = Object.freeze({
  OK: 'ok',
  EXPIRED: 'vencida',
  REFUSED: 'recusada',
  UNMEASURED: 'sem-medicao',
})

// Shopee usa App ID + chave secreta: a loja RECUSA a assinatura. ML/Amazon usam
// código de acesso (cookie de sessão) que VENCE.
const REFUSED_PLATFORMS = Object.freeze(['shopee'])

export const PLATFORM_LABELS = Object.freeze({
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  shopee: 'Shopee',
})

const DAY_MS = 24 * 60 * 60 * 1000
// A sondagem repete o aviso a cada 7 dias enquanto a chave segue ruim e a conta
// está em uso. Aviso mais velho que 2 ciclos deixa de ser prova de que a chave
// ainda está ruim (a cliente pode ter recadastrado — Credential não guarda
// data de alteração) e volta a "sem medição".
export const ALERT_VALID_MS = 14 * DAY_MS

function parsePlatform(metadata) {
  try {
    const m = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {})
    return m?.platform ?? null
  } catch {
    return null
  }
}

/**
 * Último aviso por (userId, loja).
 * @param {Array<{userId?:string|null, event?:string, metadata?:any, createdAt:Date|number|string}>} events
 * @returns {Map<string, Map<string, number>>} userId -> (loja -> ms do último aviso)
 */
export function lastAlertsByUser(events = []) {
  const byUser = new Map()
  for (const e of events) {
    if (!e?.userId || (e.event && e.event !== ALERT_EVENT)) continue
    const platform = parsePlatform(e.metadata)
    if (!platform) continue
    const at = new Date(e.createdAt).getTime()
    if (!Number.isFinite(at)) continue
    const lojas = byUser.get(e.userId) ?? new Map()
    if (!(lojas.get(platform) >= at)) lojas.set(platform, at)
    byUser.set(e.userId, lojas)
  }
  return byUser
}

/**
 * Status de UMA loja.
 * `probe` (opcional) = resultado de sondagem ao vivo; vence o evento.
 * @param {{ platform: string, lastAlertAt?: number|Date|string|null, now?: Date|number,
 *           probe?: {alive?: boolean|null}|null }} p
 */
export function resolveCredentialStatus({ platform, lastAlertAt = null, now = new Date(), probe = null } = {}) {
  const label = PLATFORM_LABELS[platform] ?? platform
  const agora = new Date(now).getTime()
  const ruim = REFUSED_PLATFORMS.includes(platform) ? CREDENTIAL_STATUS.REFUSED : CREDENTIAL_STATUS.EXPIRED
  if (probe && probe.alive === true) return { platform, label, status: CREDENTIAL_STATUS.OK, sinceMs: null, fonte: 'sondagem' }
  if (probe && probe.alive === false) return { platform, label, status: ruim, sinceMs: null, fonte: 'sondagem' }
  const at = lastAlertAt == null ? NaN : new Date(lastAlertAt).getTime()
  if (!Number.isFinite(at) || !Number.isFinite(agora) || agora - at > ALERT_VALID_MS) {
    return { platform, label, status: CREDENTIAL_STATUS.UNMEASURED, sinceMs: null, fonte: null }
  }
  return { platform, label, status: ruim, sinceMs: Math.max(0, agora - at), fonte: 'aviso' }
}

/**
 * Status das lojas com sondagem ativa, para um cliente.
 * `configured`: lojas cadastradas; se vier, só elas são listadas.
 * @param {{ alerts?: Map<string, number>|null, configured?: string[]|null, now?: Date|number }} p
 */
export function buildCredentialStatuses({ alerts = null, configured = null, now = new Date() } = {}) {
  const lojas = Array.isArray(configured)
    ? EXPIRY_ALERT_PLATFORMS.filter(p => configured.includes(p))
    : [...EXPIRY_ALERT_PLATFORMS]
  return lojas.map(platform => resolveCredentialStatus({ platform, lastAlertAt: alerts?.get(platform) ?? null, now }))
}

/** A caixa /admin/hoje só se importa com chave ruim confirmada. */
export function hasBadCredential(statuses = []) {
  return statuses.some(s => s.status === CREDENTIAL_STATUS.EXPIRED || s.status === CREDENTIAL_STATUS.REFUSED)
}

/** Tempo (ms) desde o aviso mais recente entre as lojas ruins, para o detalhe da linha. */
export function latestBadSinceMs(statuses = []) {
  const ms = statuses
    .filter(s => (s.status === CREDENTIAL_STATUS.EXPIRED || s.status === CREDENTIAL_STATUS.REFUSED) && Number.isFinite(s.sinceMs))
    .map(s => s.sinceMs)
  return ms.length ? Math.min(...ms) : null
}
