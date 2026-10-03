// Regras de conta Rakuten que não são HTTP nem banco puro: teste de conexão,
// máscara e frases leigas para a tela (espelho de awin/accountService.js).

import { RakutenAuthError, RakutenRateLimitError } from './errors.js'

export const RAKUTEN_ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  OK: 'ok',
  INVALID_CREDENTIAL: 'invalid_credential',
  ERROR: 'error',
})

// Frases que a cliente lê. Nada de "token", "API", "401". A Rakuten não diz
// QUAL dos três dados está errado (medido: mesma resposta para SID ou
// segredo errados), então a frase pede para conferir os três.
export const RAKUTEN_MESSAGES = Object.freeze({
  auth: 'A Rakuten não aceitou esses dados. Confira o SID, o Client ID e o Client Secret e salve de novo.',
  unavailable: 'Não conseguimos falar com a Rakuten agora. Tente de novo em alguns minutos.',
  rateLimited: 'A Rakuten pediu uma pausa nas consultas. Tentamos de novo sozinhos daqui a pouco.',
  accessDenied: 'A Rakuten não liberou as ofertas desta conta agora. Tentamos de novo sozinhos em 15 minutos.',
  ok: 'Conexão funcionando.',
})

export function maskSecret(last4) {
  const tail = String(last4 ?? '').slice(-4)
  return tail ? `••••${tail}` : '••••'
}

export function secretLast4(secret) {
  return String(secret ?? '').trim().slice(-4)
}

// → { ok, reason, message }
export async function testRakutenCredentials({ client, creds }) {
  try {
    await client.verify(creds)
    return { ok: true, reason: null, message: RAKUTEN_MESSAGES.ok }
  } catch (error) {
    if (error instanceof RakutenAuthError) return { ok: false, reason: 'auth', message: RAKUTEN_MESSAGES.auth }
    if (error instanceof RakutenRateLimitError) return { ok: false, reason: 'unavailable', message: RAKUTEN_MESSAGES.rateLimited }
    return { ok: false, reason: 'unavailable', message: RAKUTEN_MESSAGES.unavailable }
  }
}

// O que vai para o navegador. NUNCA inclui os campos cifrados nem a
// impressão digital — só os 4 últimos caracteres mascarados.
export function presentRakutenAccount(row, { activePromotions = 0 } = {}) {
  return {
    id: row.id,
    label: row.label,
    sid: row.sid,
    clientIdMasked: maskSecret(row.clientIdLast4),
    clientSecretMasked: maskSecret(row.clientSecretLast4),
    status: row.status,
    statusDetail: row.statusDetail ?? null,
    syncEnabled: row.syncEnabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lastSyncAt: row.lastSyncAt ?? null,
    lastSyncStatus: row.lastSyncStatus ?? null,
    nextSyncAt: row.nextSyncAt ?? null,
    lastTestAt: row.lastTestAt ?? null,
    createdAt: row.createdAt ?? null,
    activePromotions,
  }
}

export function presentRakutenSyncRun(row) {
  let errors = []
  try { errors = JSON.parse(row.errorsJson || '[]') } catch { errors = [] }
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    pages: row.pages,
    inserted: row.inserted,
    updated: row.updated,
    skipped: row.skipped,
    expired: row.expired,
    errors: Array.isArray(errors) ? errors.slice(0, 5) : [],
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
  }
}
