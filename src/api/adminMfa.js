// Segunda senha das operações de escrita do admin (header x-admin-mfa-token).
//
// Fonte ÚNICA da comparação (auditoria 2026-09-23): antes cada rota comparava
// com `===`, que devolve mais cedo no primeiro caractere diferente e deixa o
// tempo de resposta vazar o prefixo certo. Aqui os dois lados viram hash de
// tamanho fixo e são comparados com `timingSafeEqual`.
import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value) {
  return createHash('sha256').update(String(value)).digest()
}

export function safeEqualString(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (!left || !right) return false
  return timingSafeEqual(digest(left), digest(right))
}

function configuredToken(env) {
  return String(env.ADMIN_MFA_TOKEN ?? '').trim()
}

function providedToken(req) {
  return String(req?.headers?.['x-admin-mfa-token'] ?? '').trim()
}

// Regra das telas do admin: sem ADMIN_MFA_TOKEN configurado a segunda senha
// está DESLIGADA (comportamento histórico — ligar é decisão de operação).
export function isAdminMfaVerified(req, env = process.env) {
  const expected = configuredToken(env)
  if (!expected) return true
  return safeEqualString(providedToken(req), expected)
}

// Regra do reprocessamento financeiro: sem token configurado, RECUSA.
export function hasConfiguredStepUpMfa(req, env = process.env) {
  const expected = configuredToken(env)
  if (!expected) return false
  return safeEqualString(providedToken(req), expected)
}
