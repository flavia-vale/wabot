// Parar a sessão WhatsApp de uma cliente DE PROPÓSITO (`stopped_by_user`).
//
// Fonte única: a rota do admin (POST /users/:id/session/stop) e o script
// scripts/parar-sessao.mjs chamam esta função; ninguém reescreve o passo a
// passo. Sessão marcada assim não é ressuscitada pelo supervisor e não gera o
// aviso "seu robô caiu" — é escolha, não falha.
//
// Dependências entram por parâmetro (db, stopBot, isRunning, record) para o
// módulo não puxar o manager/supervisor ao ser importado e para testar sem
// banco. Ordem: marca a sessão primeiro, depois manda o comando de parada —
// se o stopBot falhar, a marca já impede o supervisor de religar.
export const STOP_REASON_MIN = 5
export const STOP_REASON_MAX = 300

export function validateStopReason(body) {
  const reason = String(body?.reason ?? '').trim()
  if (reason.length < STOP_REASON_MIN) {
    return { ok: false, error: `Motivo obrigatório com pelo menos ${STOP_REASON_MIN} caracteres.` }
  }
  return { ok: true, reason: reason.slice(0, STOP_REASON_MAX) }
}

export async function stopSessionOnPurpose({ db, userId, stopBot, isRunning, record, eventType, source, metadata = {} }) {
  const rodando = await Promise.resolve(isRunning ? isRunning(userId) : null).catch(() => null)
  await db.waSession.updateMany({
    where: { userId },
    data: { status: 'disconnected', lifecycle: 'stopped_by_user' },
  })
  record?.({
    userId,
    type: eventType,
    lifecycle: 'stopped_by_user',
    metadata: { source, ...metadata },
  })
  let parado = null
  try { parado = await stopBot(userId) } catch (err) { parado = `erro: ${err.message}` }
  return { rodando, parado }
}
