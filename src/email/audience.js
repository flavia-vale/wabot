// Quem recebe um disparo manual: tradução dos filtros do painel para uma
// consulta, e a checagem de quem sai da lista.
//
// `buildAudienceWhere` é PURA (só monta o objeto de consulta) para o filtro ser
// testável sem banco — é ele que decide quem recebe uma campanha, então errar
// aqui é mandar e-mail para a pessoa errada.
//
// Filtros aceitos (todos opcionais; combinam entre si com "E"):
//   plano            'trial' | 'basic' | 'pro'
//   acesso           'ativo' | 'vence_em' | 'vencido_ha' | 'sem_acesso'
//   dias             número que acompanha 'vence_em' / 'vencido_ha'
//   cadastradoNosUltimosDias
//   whatsapp         'conectado' | 'desconectado'
//   credencial       'com' | 'sem'
//   afiliado         'sim' | 'nao'
//   semEnvioHaDias   parado há N dias (nenhuma oferta enviada)
//   busca            trecho do nome ou do e-mail
//   userIds          seleção manual (quando vem, manda só para esses)

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const AUDIENCE_FILTERS = Object.freeze([
  { name: 'plano', label: 'Plano', options: ['trial', 'basic', 'pro'] },
  { name: 'acesso', label: 'Situação do acesso', options: ['ativo', 'vence_em', 'vencido_ha', 'sem_acesso'] },
  { name: 'dias', label: 'Quantidade de dias (para "vence em" / "vencido há")' },
  { name: 'cadastradoNosUltimosDias', label: 'Cadastrado nos últimos N dias' },
  { name: 'whatsapp', label: 'WhatsApp', options: ['conectado', 'desconectado'] },
  { name: 'credencial', label: 'Credenciais de loja', options: ['com', 'sem'] },
  { name: 'afiliado', label: 'É afiliada', options: ['sim', 'nao'] },
  { name: 'semEnvioHaDias', label: 'Sem enviar oferta há N dias' },
  { name: 'busca', label: 'Buscar por nome ou e-mail' },
])

function addDays(now, days) {
  return new Date(new Date(now).getTime() + days * MS_PER_DAY)
}

function positiveInt(value, fallback = 7) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/**
 * Monta o `where` da consulta de clientes a partir dos filtros do painel.
 * Sempre exclui conta banida/suspensa — quem não pode usar o sistema não
 * recebe campanha.
 * @param {object} filters
 * @param {Date} now
 * @returns {object}
 */
export function buildAudienceWhere(filters = {}, now = new Date()) {
  const where = { status: { notIn: ['banned', 'suspended'] } }
  const and = []

  if (Array.isArray(filters.userIds) && filters.userIds.length) {
    // Seleção manual manda em tudo: os outros filtros são ignorados de
    // propósito, para o que está marcado na tela ser exatamente o que sai.
    return { ...where, id: { in: filters.userIds.slice(0, 5000) } }
  }

  if (filters.plano) where.plan = String(filters.plano)

  const dias = positiveInt(filters.dias, 7)
  if (filters.acesso === 'ativo') {
    and.push({ accessExpiresAt: { gt: new Date(now) } })
  } else if (filters.acesso === 'vence_em') {
    and.push({ accessExpiresAt: { gt: new Date(now), lte: addDays(now, dias) } })
  } else if (filters.acesso === 'vencido_ha') {
    and.push({ accessExpiresAt: { lte: new Date(now), gte: addDays(now, -dias) } })
  } else if (filters.acesso === 'sem_acesso') {
    and.push({ OR: [{ accessExpiresAt: null }, { accessExpiresAt: { lte: new Date(now) } }] })
  }

  if (filters.cadastradoNosUltimosDias) {
    and.push({ createdAt: { gte: addDays(now, -positiveInt(filters.cadastradoNosUltimosDias, 30)) } })
  }

  if (filters.whatsapp === 'conectado') and.push({ waSession: { status: 'connected' } })
  if (filters.whatsapp === 'desconectado') {
    and.push({ OR: [{ waSession: null }, { waSession: { status: { not: 'connected' } } }] })
  }

  if (filters.credencial === 'com') and.push({ credentials: { some: {} } })
  if (filters.credencial === 'sem') and.push({ credentials: { none: {} } })

  if (filters.afiliado === 'sim') and.push({ affiliateRef: { status: 'approved' } })
  if (filters.afiliado === 'nao') and.push({ OR: [{ affiliateRef: null }, { affiliateRef: { status: { not: 'approved' } } }] })

  if (filters.semEnvioHaDias) {
    and.push({
      messageLogs: {
        none: { status: 'success', sentAt: { gte: addDays(now, -positiveInt(filters.semEnvioHaDias, 2)) } },
      },
    })
  }

  const busca = String(filters.busca ?? '').trim()
  if (busca) {
    and.push({ OR: [{ name: { contains: busca } }, { email: { contains: busca } }] })
  }

  if (and.length) where.AND = and
  return where
}

/**
 * Descreve os filtros em português, para o painel e o histórico mostrarem o
 * que foi escolhido sem a admin precisar reler JSON.
 */
export function describeAudience(filters = {}) {
  if (Array.isArray(filters.userIds) && filters.userIds.length) {
    return `${filters.userIds.length} cliente(s) escolhidos na mão`
  }
  const partes = []
  if (filters.plano) partes.push(`plano ${filters.plano}`)
  if (filters.acesso === 'ativo') partes.push('com acesso ativo')
  if (filters.acesso === 'vence_em') partes.push(`vencendo em até ${positiveInt(filters.dias)} dias`)
  if (filters.acesso === 'vencido_ha') partes.push(`vencidos nos últimos ${positiveInt(filters.dias)} dias`)
  if (filters.acesso === 'sem_acesso') partes.push('sem acesso ativo')
  if (filters.cadastradoNosUltimosDias) partes.push(`cadastrados nos últimos ${positiveInt(filters.cadastradoNosUltimosDias, 30)} dias`)
  if (filters.whatsapp === 'conectado') partes.push('com WhatsApp conectado')
  if (filters.whatsapp === 'desconectado') partes.push('com WhatsApp desconectado')
  if (filters.credencial === 'com') partes.push('com credencial de loja')
  if (filters.credencial === 'sem') partes.push('sem credencial de loja')
  if (filters.afiliado === 'sim') partes.push('afiliadas')
  if (filters.afiliado === 'nao') partes.push('que não são afiliadas')
  if (filters.semEnvioHaDias) partes.push(`sem enviar oferta há ${positiveInt(filters.semEnvioHaDias, 2)} dias`)
  if (String(filters.busca ?? '').trim()) partes.push(`buscando "${String(filters.busca).trim()}"`)
  return partes.length ? partes.join(', ') : 'todos os clientes ativos'
}

/**
 * Carrega os destinatários. Aplica também a exclusão de quem já recebeu este
 * mesmo e-mail há pouco tempo (`excluirRecebidosDias`) — a trava que impede
 * mandar a mesma campanha duas vezes para a mesma pessoa.
 */
export async function loadAudience({ db, slug, filters = {}, now = new Date(), limit = 5000 }) {
  const where = buildAudienceWhere(filters, now)
  const users = await db.user.findMany({
    where,
    select: { id: true, name: true, email: true, status: true, plan: true, accessExpiresAt: true, createdAt: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  const dias = Number(filters.excluirRecebidosDias)
  if (!slug || !Number.isFinite(dias) || dias <= 0) return users

  const since = addDays(now, -dias)
  const recentes = await db.emailSendLog.findMany({
    where: { slug, status: 'sent', createdAt: { gte: since } },
    select: { userId: true },
  }).catch(() => [])
  const jaRecebeu = new Set(recentes.map((row) => row.userId).filter(Boolean))
  return users.filter((user) => !jaRecebeu.has(user.id))
}
