// Sincronizar assinatura com o Mercado Pago em DUAS etapas (M3 da auditoria):
//   planSync()  -> lê o MP e devolve o diff. NÃO grava nada.
//   applySync() -> grava, mas só o que o diff mostrado ainda confirma (relê o
//                  MP e recusa o que mudou entre o "ver" e o "confirmar").
// Mesmo módulo do scripts/sincronizar-assinatura.mjs e das rotas
// /users/:id/assinatura/* do admin. Também aqui: checkRenewal() = os 6 elos de
// scripts/testar-recorrencia.mjs, só leitura. Nunca expõe a chave do MP.
import { decideSubscriptionStatusFromCharge, isSubscriptionActive } from './subscriptionPolicy.js'

export const MP_BASE_URL = 'https://api.mercadopago.com'

/** Cliente GET do MP. Sem chave => { ok:false } (nunca lança). */
export function createMpGet({ token, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const key = String(token ?? '').trim()
  return async function mpGet(caminho) {
    if (!key) return { ok: false, motivo: 'chave do Mercado Pago não configurada neste ambiente' }
    try {
      const r = await fetchImpl(`${MP_BASE_URL}${caminho}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const corpo = await r.json().catch(() => null)
      if (!r.ok) return { ok: false, motivo: `o Mercado Pago respondeu ${r.status}`, corpo }
      return { ok: true, corpo }
    } catch (err) {
      return { ok: false, motivo: String(err?.message || err).slice(0, 140) }
    }
  }
}

export const MP_STATUS_TRADUCAO = {
  authorized: 'VALENDO — o Mercado Pago cobra sozinho todo mês. A cliente não precisa fazer nada.',
  pending: 'EM ABERTO no Mercado Pago — o checkout nasceu e ninguém concluiu.',
  paused: 'PAUSADA no Mercado Pago.',
  cancelled: 'CANCELADA no Mercado Pago.',
}

const toMs = (d) => {
  if (!d) return null
  const t = new Date(d).getTime()
  return Number.isFinite(t) ? t : null
}
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString())

export function readPreapproval(corpo) {
  const status = String(corpo?.status || '').toLowerCase()
  const next = corpo?.next_payment_date || corpo?.auto_recurring?.next_payment_date || null
  return {
    status,
    nextChargeMs: toMs(next),
    charged: corpo?.summarized?.charged_quantity ?? null,
    hasCard: Boolean(corpo?.card_id || corpo?.payment_method_id),
  }
}

/** Puro: uma assinatura nossa + a resposta do MP => item do diff. */
export function diffSubscription(sub, mpResponse) {
  const base = {
    subscriptionId: sub.id,
    mpSubscriptionId: sub.mpSubscriptionId ?? null,
    plan: sub.plan ?? null,
    storedStatus: sub.status ?? null,
    storedNextChargeAt: iso(toMs(sub.nextChargeAt)),
  }
  if (!mpResponse?.ok) {
    return { ...base, action: 'unreachable', reason: mpResponse?.motivo || 'não consegui consultar o Mercado Pago', mpStatus: null, mpNextChargeAt: null, mpCharged: null, explanation: null }
  }
  const mp = readPreapproval(mpResponse.corpo)
  const decisao = decideSubscriptionStatusFromCharge({ storedStatus: sub.status, snapshotStatus: mp.status })
  const common = {
    ...base,
    mpStatus: mp.status || null,
    mpNextChargeAt: iso(mp.nextChargeMs),
    mpCharged: mp.charged,
    explanation: MP_STATUS_TRADUCAO[mp.status] ?? 'status fora da lista conhecida',
  }
  if (!decisao.update) return { ...common, action: 'none', reason: 'in_sync' }
  return {
    ...common,
    action: 'update',
    reason: decisao.reason,
    newStatus: decisao.status,
    // Mesma regra do script original: sem data no MP, mantém a nossa.
    newNextChargeAt: mp.nextChargeMs != null ? iso(mp.nextChargeMs) : base.storedNextChargeAt,
  }
}

async function loadSubs(db, userId) {
  return db.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 })
}

/** Etapa 1 — só leitura. */
export async function planSync({ db, userId, mpGet }) {
  const subs = await loadSubs(db, userId)
  const items = []
  for (const sub of subs) {
    items.push(diffSubscription(sub, await mpGet(`/preapproval/${sub.mpSubscriptionId}`)))
  }
  return {
    userId,
    plannedAt: new Date().toISOString(),
    hasSubscriptions: subs.length > 0,
    items,
    pending: items.filter(i => i.action === 'update').length,
  }
}

/**
 * Etapa 2 — grava. `shown` é o diff que o admin viu. Nada vem dele para o
 * banco: relê o MP e só grava o item cujo resultado ainda é IGUAL ao mostrado
 * (status e próxima cobrança). Mudou no meio => `stale`, nada gravado.
 */
export async function applySync({ db, userId, shown, mpGet }) {
  const wanted = (Array.isArray(shown?.items) ? shown.items : []).filter(i => i?.action === 'update')
  const fresh = await planSync({ db, userId, mpGet })
  const results = []
  for (const w of wanted) {
    const cur = fresh.items.find(i => i.subscriptionId === w.subscriptionId)
    if (!cur || cur.action !== 'update') {
      results.push({ subscriptionId: w.subscriptionId, applied: false, reason: cur ? 'ja_sincronizada_ou_sem_mudanca' : 'assinatura_nao_encontrada' })
      continue
    }
    if (cur.newStatus !== w.newStatus || cur.newNextChargeAt !== (w.newNextChargeAt ?? null)) {
      results.push({ subscriptionId: w.subscriptionId, applied: false, reason: 'stale' })
      continue
    }
    await db.subscription.update({
      where: { id: cur.subscriptionId },
      data: { status: cur.newStatus, nextChargeAt: cur.newNextChargeAt ? new Date(cur.newNextChargeAt) : null },
    })
    results.push({
      subscriptionId: cur.subscriptionId,
      applied: true,
      before: { status: cur.storedStatus, nextChargeAt: cur.storedNextChargeAt },
      after: { status: cur.newStatus, nextChargeAt: cur.newNextChargeAt },
    })
  }
  return { results, applied: results.filter(r => r.applied).length, stale: results.filter(r => r.reason === 'stale').length }
}

/**
 * "A cobrança automática vai mesmo acontecer?" — os 6 elos, só leitura.
 * Cada elo: { id, title, ok (true|false|null=não sei), lines[] }.
 */
export async function checkRenewal({ db, user, mpGet, now = new Date(), days = 7 }) {
  const desde = new Date(now.getTime() - days * 86_400_000)
  const sub = await db.subscription.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  if (!sub) return { hasSubscription: false, elos: [], verdict: { armed: false, text: 'Nenhuma assinatura recorrente nesta conta (só pagamento avulso).' } }

  const elos = []
  const pre = await mpGet(`/preapproval/${sub.mpSubscriptionId}`)
  let mp = null
  if (!pre.ok) {
    elos.push({ id: 'mp_valendo', title: 'O Mercado Pago tem a assinatura como valendo?', ok: null, lines: [`Não consegui perguntar ao Mercado Pago (${pre.motivo}).`] })
  } else {
    mp = readPreapproval(pre.corpo)
    const lines = []
    lines.push(mp.status === 'authorized' ? 'Está valendo — o MP cobra sozinho.' : `Status "${mp.status}" — o MP NÃO vai cobrar sozinho assim.`)
    lines.push(mp.hasCard ? 'Tem cartão vinculado.' : 'Nenhum cartão vinculado — não há como cobrar.')
    lines.push(`Próxima cobrança: ${iso(mp.nextChargeMs) ?? '—'} · cobranças já feitas: ${mp.charged ?? '—'}`)
    elos.push({ id: 'mp_valendo', title: 'O Mercado Pago tem a assinatura como valendo?', ok: mp.status === 'authorized' && mp.hasCard, lines })
  }

  const faturas = await mpGet(`/authorized_payments/search?preapproval_id=${sub.mpSubscriptionId}`)
  if (!faturas.ok) {
    elos.push({ id: 'mp_cobrou', title: 'O Mercado Pago já cobrou alguma vez?', ok: null, lines: [`Não consegui listar as cobranças (${faturas.motivo}).`] })
  } else {
    const linhas = faturas.corpo?.results ?? []
    elos.push({
      id: 'mp_cobrou',
      title: 'O Mercado Pago já cobrou alguma vez?',
      ok: linhas.length > 0,
      lines: linhas.length
        ? linhas.slice(0, 6).map(f => `${iso(toMs(f?.date_created)) ?? '—'} · R$ ${f?.transaction_amount ?? '—'} · ${f?.status ?? '?'}${f?.payment?.status_detail ? ` (${f.payment.status_detail})` : ''}`)
        : ['Nenhuma cobrança registrada ainda no Mercado Pago.'],
    })
  }

  const avisos = await db.webhookEvent.findMany({
    where: { provider: 'mercado_pago', createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { eventType: true, processingStatus: true, error: true, createdAt: true },
  }).catch(() => [])
  const daAssinatura = avisos.filter(a => String(a.eventType || '').startsWith('subscription'))
  elos.push({
    id: 'aviso_chega',
    title: `O Mercado Pago nos avisa? (últimos ${days} dias)`,
    ok: daAssinatura.length > 0,
    lines: daAssinatura.length
      ? [`${daAssinatura.length} aviso(s) de assinatura recebidos.`]
      : ['Nenhum aviso de assinatura chegou na janela.', 'Se há cobrança no MP e aqui não chega aviso, marque no painel do Mercado Pago os eventos de assinatura e de pagamento (Webhooks).'],
  })
  const comErro = daAssinatura.filter(a => a.error || a.processingStatus === 'dlq')
  elos.push({
    id: 'aviso_processado',
    title: 'O aviso foi processado por nós, sem erro?',
    ok: daAssinatura.length ? comErro.length === 0 : null,
    lines: !daAssinatura.length ? ['Sem aviso na janela — nada a conferir.'] : comErro.length ? [`${comErro.length} aviso(s) com erro no processamento.`] : ['Todos processados sem erro.'],
  })

  const mpStatus = mp?.status ?? null
  const diverge = Boolean(mpStatus) && mpStatus !== String(sub.status ?? '').toLowerCase()
  elos.push({
    id: 'banco_espelha',
    title: 'O nosso banco espelha o Mercado Pago?',
    ok: mpStatus ? !diverge : null,
    lines: [`Aqui: ${sub.status} · próxima ${iso(toMs(sub.nextChargeAt)) ?? '—'}`, diverge ? 'DIVERGENTE — use "Sincronizar com o Mercado Pago".' : mpStatus ? 'Bate com o Mercado Pago.' : 'Sem resposta do MP para comparar.'],
  })

  const proximaMs = mp?.nextChargeMs ?? toMs(sub.nextChargeAt)
  const acessoMs = toMs(user.accessExpiresAt)
  let acessoOk = null
  const linhasAcesso = []
  if (proximaMs == null) linhasAcesso.push('Sem data de próxima cobrança — nada a comparar.')
  else if (acessoMs == null || acessoMs >= proximaMs) { acessoOk = true; linhasAcesso.push(`Acesso até ${iso(acessoMs) ?? 'sem vencimento'} cobre a cobrança de ${iso(proximaMs)}.`) }
  else { acessoOk = false; linhasAcesso.push(`Acesso vence ${iso(acessoMs)} ANTES da cobrança de ${iso(proximaMs)}.`, 'A reconciliação horária estende sozinha; se não estender em 1h, ela não está rodando neste ambiente.') }
  elos.push({ id: 'acesso_cobre', title: 'O acesso da cliente cobre até a próxima cobrança?', ok: acessoOk, lines: linhasAcesso })

  const armed = isSubscriptionActive(mpStatus || sub.status) && proximaMs != null
  return {
    hasSubscription: true,
    elos,
    verdict: {
      armed,
      text: armed
        ? 'A cobrança automática está armada no Mercado Pago. O que resta provar só no mês que vem é a cobrança em si.'
        : 'A cobrança automática NÃO está armada. Veja os elos marcados com problema.',
    },
  }
}
