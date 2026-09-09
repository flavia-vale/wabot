// Aplica a decisão de `trialAnchor.js` na conta. Db injetado para testar sem
// banco; a decisão em si é pura e mora no módulo irmão.
//
// Onde roda: no `GET /status` da sessão, quando o WhatsApp aparece conectado —
// é o primeiro momento em que a API sabe, com certeza, que a cliente conectou.
// Fazer isso no `bot-worker.js` colocaria regra de cobrança dentro do worker e,
// pior, ficaria dormente até alguém reiniciar o `bot-supervisor` (que reconecta
// TODAS as sessões de uma vez — ver AGENTS.md).
//
// Sem tabela nova e sem migration: o marcador de "esta conta já foi ancorada" é
// um `AnalyticsEvent`, mesmo padrão do `credential_expiry_alert_sent`.
//
// Custo: o `GET /status` é consultado a cada poucos segundos pelo painel, então
// uma consulta por chamada seria caro. O `Set` em memória garante **uma
// avaliação por conta por processo da API** — depois disso a função sai na
// primeira linha. É um Set de ids (algumas centenas de strings), com teto, para
// não crescer sem limite: nenhum impacto relevante de RAM.

import { trackAnalyticsEventSafe } from '../../analytics.js'
import { decideTrialAnchor, trialAnchorEnabled } from './trialAnchor.js'

export const TRIAL_ANCHOR_EVENT = 'trial_anchored_at_connection'

/** Teto do cache em memória; estourou, esvazia (a consulta volta a valer). */
const MAX_CACHE = 5000
const jaAvaliado = new Set()

/** Só para teste — o cache é escopo de módulo de propósito. */
export function resetTrialAnchorCache() {
  jaAvaliado.clear()
}

/**
 * @param {object} args
 * @param {object} args.db
 * @param {string} args.userId
 * @param {number} args.trialDays
 * @param {Date} [args.now]
 * @param {object} [args.logger]
 * @returns {Promise<{ anchored: boolean, reason: string, until: Date|null }>}
 */
export async function anchorTrialOnFirstConnection({ db, userId, trialDays, now = new Date(), logger } = {}) {
  const nao = (reason) => ({ anchored: false, reason, until: null })

  // Desligado: nem toca no banco. Este é o caminho de produção enquanto o
  // interruptor não for validado em staging.
  if (!trialAnchorEnabled()) return nao('desligado')
  if (!db || !userId) return nao('sem_dados')
  if (jaAvaliado.has(userId)) return nao('ja_avaliado_neste_processo')

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true, createdAt: true, accessExpiresAt: true },
    })
    if (!user) {
      jaAvaliado.add(userId)
      return nao('conta_nao_encontrada')
    }

    // Conta paga não custa nem a consulta do marcador.
    if (user.plan !== 'trial') {
      jaAvaliado.add(userId)
      return nao('nao_e_teste')
    }

    const marcador = await db.analyticsEvent.findFirst({
      where: { userId, event: TRIAL_ANCHOR_EVENT },
      select: { id: true },
    })

    const decisao = decideTrialAnchor({
      plan: user.plan,
      createdAt: user.createdAt,
      accessExpiresAt: user.accessExpiresAt,
      alreadyAnchored: Boolean(marcador),
      trialDays,
      now,
    })

    if (!decisao.anchor) {
      // 'ja_vale_mais' é transitório (o acesso pode encurtar): só é definitivo
      // o que não muda com o tempo.
      if (decisao.reason !== 'ja_vale_mais') jaAvaliado.add(userId)
      return nao(decisao.reason)
    }

    await db.user.update({ where: { id: userId }, data: { accessExpiresAt: decisao.until } })
    // O marcador é gravado DEPOIS do update: se o update falhar, a próxima
    // chamada tenta de novo em vez de marcar como feito algo que não foi.
    trackAnalyticsEventSafe({
      userId,
      event: TRIAL_ANCHOR_EVENT,
      metadata: { until: decisao.until.toISOString(), trialDays },
    })
    if (jaAvaliado.size >= MAX_CACHE) jaAvaliado.clear()
    jaAvaliado.add(userId)
    logger?.info?.({ userId, until: decisao.until }, 'Teste passou a contar da primeira conexão')
    return { anchored: true, reason: decisao.reason, until: decisao.until }
  } catch (err) {
    // Falha aqui NUNCA pode derrubar o status da sessão — o painel inteiro
    // depende dessa rota.
    logger?.warn?.({ userId, err: err?.message }, 'Não deu para ancorar o teste na primeira conexão')
    return nao('falhou')
  }
}
