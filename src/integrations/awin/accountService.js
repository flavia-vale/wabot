// Regras de conta Awin que não são HTTP nem banco puro: teste de conexão,
// máscara do código e frases leigas para a tela.

import { AwinAuthError, AwinRateLimitError } from './errors.js'
import { extractAccounts } from './translate.js'

export const AWIN_ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  OK: 'ok',
  INVALID_CREDENTIAL: 'invalid_credential',
  ERROR: 'error',
})

// Frases que a cliente lê. Nada de "token", "API", "401" (linguagem leiga —
// test/painel-linguagem-leiga.test.js e test/awin-linguagem.test.js).
export const AWIN_MESSAGES = Object.freeze({
  auth: 'A Awin não aceitou o código de acesso. Gere um código novo na Awin e salve aqui.',
  publisherNotFound: 'Esse número de conta não aparece para esse código de acesso. Confira o número no canto de cima da Awin. Se você acabou de ganhar acesso a essa conta, espere 10 minutos e tente de novo.',
  unavailable: 'Não conseguimos falar com a Awin agora. Tente de novo em alguns minutos.',
  rateLimited: 'A Awin pediu uma pausa nas consultas. Tentamos de novo sozinhos daqui a pouco.',
  ok: 'Conexão funcionando.',
})

export function maskToken(last4) {
  const tail = String(last4 ?? '').slice(-4)
  return tail ? `••••${tail}` : '••••'
}

export function tokenLast4(token) {
  return String(token ?? '').trim().slice(-4)
}

// Chamada leve (GET /accounts): o código vale? o número da conta é dele?
// → { ok, reason, accountName }
export async function testAwinCredentials({ client, token, publisherId }) {
  try {
    const body = await client.listAccounts(token, { type: 'publisher' })
    const accounts = extractAccounts(body)
    if (!accounts) return { ok: false, reason: 'unavailable', message: AWIN_MESSAGES.unavailable }
    const match = accounts.find((account) => account.accountId === String(publisherId).trim())
    if (!match) return { ok: false, reason: 'publisher_not_found', message: AWIN_MESSAGES.publisherNotFound }
    return { ok: true, reason: null, message: AWIN_MESSAGES.ok, accountName: match.accountName }
  } catch (error) {
    if (error instanceof AwinAuthError) return { ok: false, reason: 'auth', message: AWIN_MESSAGES.auth }
    if (error instanceof AwinRateLimitError) return { ok: false, reason: 'unavailable', message: AWIN_MESSAGES.rateLimited }
    return { ok: false, reason: 'unavailable', message: AWIN_MESSAGES.unavailable }
  }
}

// O que vai para o navegador. NUNCA inclui tokenEncrypted nem a impressão
// digital — só os 4 últimos caracteres mascarados.
export function presentAwinAccount(row, { activePromotions = 0 } = {}) {
  return {
    id: row.id,
    label: row.label,
    publisherId: row.publisherId,
    tokenMasked: maskToken(row.tokenLast4),
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

export function presentAwinSyncRun(row) {
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
