// Carregador do sinal de teste repetido. A REGRA mora em
// `duplicateTrialSignal.js` (puro, testável sem banco); aqui só buscamos os
// candidatos e avisamos.
//
// Nada nisto pode derrubar o cadastro: é tudo best-effort, com try/catch no
// chamador. Perder um aviso interno é barato; perder uma cliente no cadastro
// por causa de um aviso não é.

import { decideDuplicateTrialSignal, emailRoot, MIN_EMAIL_ROOT_LENGTH } from './duplicateTrialSignal.js'
import { sendAdminAlert as defaultSendAdminAlert } from '../../email/adminAlerts.js'

/** Teto de candidatos por consulta — o aviso é qualitativo, não um relatório. */
const MAX_CANDIDATOS = 25

/**
 * Busca contas anteriores que possam ser da mesma pessoa.
 *
 * Duas consultas estreitas em vez de varrer a base: uma pelo começo do e-mail
 * (coberta pelo índice de `email`, que é único) e outra pelo nome em minúsculas
 * (`lower`/`trim` são SQL padrão, valem em SQLite e Postgres). O filtro fino
 * fica com o módulo puro.
 */
export async function loadDuplicateTrialCandidates({ db, user }) {
  if (!db || !user?.id) return []
  const raiz = emailRoot(user.email)
  const nomeSql = String(user.name ?? '').trim().toLowerCase()

  const [porEmail, porNome] = await Promise.all([
    raiz && raiz.length >= MIN_EMAIL_ROOT_LENGTH
      ? db.user.findMany({
          where: { id: { not: user.id }, accessExpiresAt: { not: null }, email: { startsWith: raiz } },
          select: { id: true, name: true, email: true, accessExpiresAt: true },
          take: MAX_CANDIDATOS,
        }).catch(() => [])
      : Promise.resolve([]),
    nomeSql
      ? db.$queryRaw`
          SELECT id, name, email, accessExpiresAt FROM User
          WHERE id <> ${user.id} AND accessExpiresAt IS NOT NULL
            AND lower(trim(name)) = ${nomeSql}
          LIMIT ${MAX_CANDIDATOS}
        `.catch(() => [])
      : Promise.resolve([]),
  ])

  const porId = new Map()
  for (const linha of [...porEmail, ...porNome]) {
    if (linha?.id) porId.set(linha.id, linha)
  }
  return [...porId.values()]
}

/**
 * Roda a checagem e avisa. Devolve a decisão para quem quiser logar.
 *
 * O aviso vai por DOIS caminhos de propósito: o sinal durável
 * (`signup_duplicate_trial_suspect` em `AnalyticsEvent`), que é o que permite
 * medir o tamanho do problema depois, e o e-mail interno, que é o que faz
 * alguém de fato olhar. Aviso que fica só no log não conta como aviso — foi
 * essa a lição do `ops_stale_worker_code`.
 */
export async function checkDuplicateTrialAtSignup({ db, user, trackEvent, sendAdminAlert = defaultSendAdminAlert, logger } = {}) {
  const anteriores = await loadDuplicateTrialCandidates({ db, user })
  const decisao = decideDuplicateTrialSignal({
    novo: { id: user?.id, name: user?.name, email: user?.email, createdAt: user?.createdAt ?? new Date() },
    anteriores,
  })
  if (!decisao.suspeito) return decisao

  logger?.warn?.({ userId: user.id, motivo: decisao.motivo, contas: decisao.contas.length }, 'Cadastro parece repetir teste de outra conta')

  trackEvent?.({
    userId: user.id,
    event: 'signup_duplicate_trial_suspect',
    metadata: { motivo: decisao.motivo, contas: decisao.contas.length },
  })

  // `key` leva o id da conta nova: o cooldown de 24h do canal interno é por
  // assunto, e sem isso o segundo caso do dia sairia calado.
  await Promise.resolve(sendAdminAlert?.({
    db,
    slug: 'admin_teste_repetido',
    key: user.id,
    vars: {
      cliente: user.email ?? '',
      nome: user.name ?? '',
      motivo: decisao.motivo ?? '',
      contas_anteriores: decisao.contas.map(c => c.email).filter(Boolean).join(', '),
      quando: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    },
    logger,
  })).catch(() => {})

  return decisao
}
