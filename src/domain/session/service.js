export function normalizePairingPhone(rawPhone) {
  const digits = String(rawPhone ?? '').replace(/\D/g, '')
  if (!digits) return { ok: false, message: 'Número de telefone obrigatório' }

  let br = digits
  if (br.startsWith('55')) br = br.slice(2)

  if (br.length < 10 || br.length > 11) {
    return { ok: false, message: 'Número inválido. Use DDI+DDD+número (ex.: 5511999999999).' }
  }

  const ddd = br.slice(0, 2)
  const subscriber = br.slice(2)
  if (!/^\d{2}$/.test(ddd)) return { ok: false, message: 'DDD inválido.' }
  if (subscriber.length === 9 && !subscriber.startsWith('9')) {
    return { ok: false, message: 'Celular com 9 dígitos deve iniciar com 9.' }
  }

  return { ok: true, phone: `55${ddd}${subscriber}` }
}

function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

export function createSessionService({ db } = {}) {
  if (!db) throw new Error('createSessionService: db é obrigatório')

  async function findSessionStartUser(userId) {
    try {
      return await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true, status: true } })
    } catch (err) {
      if (!isPrismaShapeMismatch(err)) throw err
      return db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
    }
  }

  function validateSessionStartUser(user) {
    if (user?.status === 'banned' || user?.status === 'suspended') {
      return { ok: false, statusCode: 403, error: 'Conta bloqueada. Entre em contato com o suporte.' }
    }
    if (user?.accessExpiresAt && user.accessExpiresAt < new Date()) {
      const msg = user.plan === 'trial' ? 'Seu trial expirou. Assine um plano em Planos.' : 'Sua assinatura expirou. Renove em Planos.'
      return { ok: false, statusCode: 403, error: msg }
    }
    return { ok: true }
  }

  return { findSessionStartUser, validateSessionStartUser }
}

// Resultado de "mandei ligar o robô". Distingue RECUSA do servidor (não havia
// onde ligar: teto de sessões por processo atingido, ou sessão fora do shard)
// de "mandei ligar e ele não subiu a tempo".
//
// RCA 2026-09-01: as rotas de conectar descartavam o retorno do startBot. Com o
// supervisor no teto (20/20), o robô simplesmente não subia e a cliente lia
// "Bot não está conectado" — texto que não diz nada e a faz tentar de novo sem
// chance nenhuma de sucesso. Foram 183 recusas invisíveis antes de alguém
// perceber. Linguagem leiga obrigatória aqui (a mensagem vai direto para a
// tela): nada de "worker", "supervisor", "circuit breaker" ou "shard".
export function classifyBotStartOutcome({ startAccepted, running }) {
  if (running) return { ok: true }
  if (startAccepted === false) {
    return {
      ok: false,
      statusCode: 503,
      code: 'WA_CAPACITY_LIMIT',
      error: 'Nosso servidor está no limite de robôs ligados ao mesmo tempo. Nossa equipe já foi avisada — tente de novo em alguns minutos.',
      retryable: true,
    }
  }
  return {
    ok: false,
    statusCode: 503,
    code: 'WA_START_FAILED',
    error: 'Não conseguimos ligar seu robô agora. Tente de novo em instantes.',
    retryable: true,
  }
}
