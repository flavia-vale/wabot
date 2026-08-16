// Link de "criar uma nova senha": token assinado, sem tabela nova.
//
// Formato: base64url(userId).<expiraEm>.<assinatura>
// A assinatura é HMAC-SHA256 de `userId.expiraEm.impressãoDaSenhaAtual` com o
// JWT_SECRET. Puro — sem I/O; o chamador injeta o segredo e o hash atual.
//
// Duas propriedades importantes vêm da "impressão da senha atual" entrar na
// assinatura:
//   1. USO ÚNICO de graça: ao trocar a senha, o hash muda e QUALQUER link
//      antigo deixa de validar — sem precisar guardar token usado no banco.
//   2. Link antigo morre quando a senha muda por outro caminho (troca pelo
//      painel), que é exatamente o que se espera de um link de recuperação.
//
// O tempo de vida é curto de propósito: um link de recuperação parado numa
// caixa de e-mail é uma chave da conta.

import { createHmac, timingSafeEqual } from 'crypto'

export const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hora

function base64urlEncode(value) {
  return Buffer.from(String(value), 'utf8').toString('base64url')
}

function base64urlDecode(value) {
  try {
    return Buffer.from(String(value), 'base64url').toString('utf8')
  } catch {
    return null
  }
}

// Só um pedaço do hash entra na assinatura — o hash inteiro nunca circula.
function passwordFingerprint(passwordHash) {
  return createHmac('sha256', 'wabot-password-reset').update(String(passwordHash ?? '')).digest('hex').slice(0, 32)
}

function computeSignature({ userId, expiresAt, passwordHash, secret }) {
  return createHmac('sha256', String(secret))
    .update(`${userId}.${expiresAt}.${passwordFingerprint(passwordHash)}`)
    .digest('hex')
}

/**
 * @param {{ userId: string, passwordHash: string, secret: string, now?: number, ttlMs?: number }} params
 * @returns {string}
 */
export function signPasswordResetToken({ userId, passwordHash, secret, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) {
  const expiresAt = now + ttlMs
  const signature = computeSignature({ userId, expiresAt, passwordHash, secret })
  return `${base64urlEncode(userId)}.${expiresAt}.${signature}`
}

/**
 * Lê o userId de um token SEM validar assinatura — serve só para o servidor
 * saber de quem é o hash que precisa buscar. Nunca autoriza nada sozinho.
 * @returns {string|null}
 */
export function peekPasswordResetUserId(token) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) return null
  return base64urlDecode(parts[0])
}

/**
 * Valida o token contra o hash de senha ATUAL do cliente.
 * @returns {{ valid: true, userId: string } | { valid: false, reason: 'malformed'|'expired'|'invalid' }}
 */
export function verifyPasswordResetToken({ token, passwordHash, secret, now = Date.now() }) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) return { valid: false, reason: 'malformed' }
  const [encodedUserId, rawExpiresAt, signature] = parts

  const userId = base64urlDecode(encodedUserId)
  const expiresAt = Number(rawExpiresAt)
  if (!userId || !Number.isFinite(expiresAt) || !signature) return { valid: false, reason: 'malformed' }
  if (expiresAt <= now) return { valid: false, reason: 'expired' }

  const expected = computeSignature({ userId, expiresAt, passwordHash, secret })
  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== providedBuf.length) return { valid: false, reason: 'invalid' }
  if (!timingSafeEqual(expectedBuf, providedBuf)) return { valid: false, reason: 'invalid' }

  return { valid: true, userId }
}
