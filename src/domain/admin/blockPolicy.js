// Bloquear / desbloquear / banir conta de cliente (regra PURA, sem banco).
//
// Auditoria do admin (docs/admin/auditoria-painel-admin.md, 3.6): bloquear
// exigia só `support:write` (o mesmo nível de "registrar contato"), não havia
// tela e o motivo podia ter 1 letra. Agora: papel alto (`admin:write`, só o
// dono), motivo com mínimo e dupla confirmação — a pessoa digita o e-mail da
// conta, igual a quem apaga um repositório. O servidor confere de novo: a tela
// não é a única barreira.

export const BLOCK_PERMISSION = 'admin:write'
export const BLOCK_REASON_MIN = 10
export const BLOCK_REASON_MAX = 400
export const BLOCK_STATUSES = ['suspended', 'banned']

const norm = value => String(value ?? '').trim().toLowerCase()

/**
 * @param {{ action: 'block'|'unblock', status?: string, reason?: string,
 *           confirmEmail?: string, accountEmail?: string }} input
 * @returns {{ ok: true, status: string|null, reason: string } | { ok: false, error: string }}
 */
export function validateBlockRequest({ action = 'block', status, reason, confirmEmail, accountEmail } = {}) {
  let finalStatus = null
  if (action === 'block') {
    finalStatus = String(status ?? 'suspended').trim()
    if (!BLOCK_STATUSES.includes(finalStatus)) return { ok: false, error: 'status deve ser suspended ou banned' }
  }
  const text = String(reason ?? '').trim().slice(0, BLOCK_REASON_MAX)
  if (text.length < BLOCK_REASON_MIN) {
    return { ok: false, error: `Escreva o motivo com pelo menos ${BLOCK_REASON_MIN} letras — ele fica na auditoria${action === 'block' ? ' e é mostrado para a cliente' : ''}` }
  }
  const expected = norm(accountEmail)
  if (!expected || norm(confirmEmail) !== expected) {
    return { ok: false, error: 'Confirmação não bate: digite o e-mail exato da conta para continuar' }
  }
  return { ok: true, status: finalStatus, reason: text }
}
