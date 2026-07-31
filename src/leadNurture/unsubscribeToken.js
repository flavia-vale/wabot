// Token stateless de descadastro da trilha de nutrição de leads (LGPD).
//
// Formato: base64url(userId) + '.' + HMAC_SHA256(userId, key=secret) em hex.
// Puro — sem I/O, sem env lida diretamente (o secret é injetado pelo chamador,
// tipicamente process.env.JWT_SECRET). Comparação em tempo constante via
// crypto.timingSafeEqual para evitar timing attack na verificação do HMAC.

import { createHmac, timingSafeEqual } from 'crypto'

function base64urlEncode(str) {
  return Buffer.from(String(str), 'utf8').toString('base64url')
}

function base64urlDecode(str) {
  try {
    return Buffer.from(String(str), 'base64url').toString('utf8')
  } catch {
    return null
  }
}

function computeHmac(userId, secret) {
  return createHmac('sha256', String(secret)).update(String(userId)).digest('hex')
}

/**
 * Assina um token de descadastro para o userId. Função pura.
 * @param {string} userId
 * @param {string} secret
 * @returns {string}
 */
export function signUnsubscribeToken(userId, secret) {
  const encodedUserId = base64urlEncode(userId)
  const signature = computeHmac(userId, secret)
  return `${encodedUserId}.${signature}`
}

/**
 * Verifica um token de descadastro. Retorna { userId } se válido, ou null
 * (token ausente/malformado/HMAC inválido) sem lançar exceção.
 * @param {string} token
 * @param {string} secret
 * @returns {{ userId: string } | null}
 */
export function verifyUnsubscribeToken(token, secret) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encodedUserId, signature] = parts
  if (!encodedUserId || !signature) return null

  const userId = base64urlDecode(encodedUserId)
  if (!userId) return null

  const expectedSignature = computeHmac(userId, secret)
  const expectedBuf = Buffer.from(expectedSignature, 'hex')
  const providedBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== providedBuf.length) return null
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null

  return { userId }
}
