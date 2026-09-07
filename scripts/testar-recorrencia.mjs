#!/usr/bin/env node
// "A cobrança automática vai mesmo acontecer todo mês?" — read-only.
//
//   cd ~/wabot && node scripts/testar-recorrencia.mjs <email> [--days=7]
//
// Ninguém precisa (nem consegue) esperar 30 dias para saber. A renovação
// depende de SEIS elos, e cada um dá para conferir hoje:
//
//   [1] o Mercado Pago tem a assinatura como VALENDO, com cartão vinculado e
//       data da próxima cobrança;
//   [2] o MP já COBROU pelo menos uma vez (a primeira cobrança é a mesma
//       máquina que vai rodar no mês que vem);
//   [3] o MP nos AVISA — é o elo que mais quebra, e ele quebra em silêncio
//       (evento não marcado no painel do MP);
//   [4] o aviso foi PROCESSADO por nós, sem erro;
//   [5] o nosso banco espelha o que o MP diz (status e próxima cobrança);
//   [6] o acesso da cliente cobre até a próxima cobrança — e, se o aviso da
//       renovação se perder, a reconciliação horária estende sozinha.
//
// Não altera nada e não imprime segredo.
import 'dotenv/config'
import db from '../src/db.js'
import { isSubscriptionActive } from '../src/domain/payments/subscriptionPolicy.js'

const args = process.argv.slice(2)
const alvo = args.find(a => !a.startsWith('--')) || null
const dias = Math.max(1, Number((args.find(a => a.startsWith('--days=')) || '').split('=')[1] || 7))
const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
const MP_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim()

// Horário em UTC, como está gravado no banco — marcado com Z de propósito.
const fmt = (d) => (d ? `${new Date(d).toISOString().slice(0, 19).replace('T', ' ')}Z` : '—')
const ok = (t) => console.log(`    ✓ ${t}`)
const nao = (t) => console.log(`    ✗ ${t}`)
const info = (t) => console.log(`      ${t}`)

async function mpGet(caminho) {
  if (!MP_TOKEN) return { ok: false, motivo: 'chave do Mercado Pago não configurada neste ambiente' }
  try {
    const r = await fetch(`https://api.mercadopago.com${caminho}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok) return { ok: false, motivo: `o Mercado Pago respondeu ${r.status}`, corpo }
    return { ok: true, corpo }
  } catch (err) {
    return { ok: false, motivo: String(err?.message || err).slice(0, 140) }
  }
}

async function main() {
  if (!alvo) {
    console.log('Uso: node scripts/testar-recorrencia.mjs <email> [--days=7]')
    process.exit(1)
  }

  const users = await db.user.findMany({
    where: { OR: [{ email: { contains: alvo } }, { contactPhone: { contains: alvo } }, { name: { contains: alvo } }] },
    select: { id: true, email: true, name: true, plan: true, accessExpiresAt: true },
  }).catch(err => {
    // Erro engolido em diagnóstico vira conclusão errada — imprime.
    console.log(`Falha ao procurar a conta: ${err?.message || err}`)
    return []
  })
  if (!users.length) return console.log(`Nenhuma conta com "${alvo}".`)

  for (const user of users) {
    console.log(`\n=== ${user.email || user.name || user.id}`)
    console.log(`    plano ${user.plan} · acesso até ${fmt(user.accessExpiresAt)}`)

    const sub = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (!sub) {
      nao('nenhuma assinatura recorrente nesta conta (só pagamento avulso).')
      continue
    }

    // [1] o MP considera a assinatura valendo?
    console.log('\n  [1] O Mercado Pago tem a assinatura como valendo?')
    const pre = await mpGet(`/preapproval/${sub.mpSubscriptionId}`)
    let proximaMp = null
    let statusMp = null
    if (!pre.ok) {
      nao(`não consegui perguntar ao Mercado Pago (${pre.motivo})`)
    } else {
      statusMp = String(pre.corpo?.status || '').toLowerCase()
      proximaMp = pre.corpo?.next_payment_date || pre.corpo?.auto_recurring?.next_payment_date || null
      const cartao = pre.corpo?.card_id || pre.corpo?.payment_method_id || null
      const cobradas = pre.corpo?.summarized?.charged_quantity ?? null
      if (statusMp === 'authorized') ok('está VALENDO — o MP cobra sozinho.')
      else nao(`status "${statusMp}" — o MP NÃO vai cobrar sozinho assim.`)
      // Sem cartão vinculado nada foi cobrado: a pessoa não concluiu.
      if (cartao) ok('tem cartão vinculado.')
      else nao('NENHUM cartão vinculado — não há como cobrar.')
      info(`próxima cobrança: ${fmt(proximaMp)} · cobranças já feitas: ${cobradas ?? '—'}`)
    }

    // [2] a máquina de cobrar já rodou pelo menos uma vez?
    console.log('\n  [2] O Mercado Pago já cobrou alguma vez?')
    const faturas = await mpGet(`/authorized_payments/search?preapproval_id=${sub.mpSubscriptionId}`)
    if (!faturas.ok) {
      nao(`não consegui listar as cobranças (${faturas.motivo})`)
    } else {
      const linhas = faturas.corpo?.results ?? []
      if (!linhas.length) nao('nenhuma cobrança registrada ainda no Mercado Pago.')
      else ok(`${linhas.length} cobrança(s) — a mesma máquina que roda no mês que vem:`)
      for (const f of linhas.slice(0, 6)) {
        info(`${fmt(f?.date_created)} · R$ ${f?.transaction_amount ?? '—'} · ${f?.status ?? '?'}${f?.payment?.status_detail ? ` (${f.payment.status_detail})` : ''}`)
      }
    }

    // [3] e [4] o aviso chega até nós e é processado?
    console.log(`\n  [3] O Mercado Pago nos avisa? (últimos ${dias} dias)`)
    const avisos = await db.webhookEvent.findMany({
      where: { provider: 'mercado_pago', createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { eventType: true, dataId: true, processingStatus: true, error: true, createdAt: true },
    }).catch(() => [])
    const daAssinatura = avisos.filter(a => String(a.eventType || '').startsWith('subscription'))
    if (!daAssinatura.length) {
      nao('nenhum aviso de assinatura chegou na janela.')
      info('Se o [2] mostra cobrança e aqui não chega aviso, o elo quebrado é este:')
      info('marque os eventos subscription_preapproval, subscription_authorized_payment')
      info('E payment no painel do Mercado Pago (Webhooks).')
    } else {
      ok(`${daAssinatura.length} aviso(s) de assinatura recebidos:`)
      for (const a of daAssinatura.slice(0, 8)) {
        info(`${fmt(a.createdAt)} · ${a.eventType} · ${a.processingStatus}${a.error ? ` · ERRO: ${a.error}` : ''}`)
      }
      const comErro = daAssinatura.filter(a => a.error || a.processingStatus === 'dlq')
      if (comErro.length) nao(`${comErro.length} aviso(s) com erro no processamento — ver acima.`)
      else ok('todos processados sem erro.')
    }

    // [5] nosso banco bate com o MP?
    console.log('\n  [5] O nosso banco espelha o Mercado Pago?')
    console.log(`      aqui: ${sub.status} · próxima ${fmt(sub.nextChargeAt)}`)
    if (statusMp && statusMp !== String(sub.status).toLowerCase()) {
      nao('DIVERGENTE — rode: node scripts/sincronizar-assinatura.mjs <email> --aplicar')
    } else if (statusMp) ok('bate com o Mercado Pago.')

    const pagamentos = await db.payment.findMany({
      where: { userId: user.id, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { amount: true, createdAt: true, mpPaymentId: true },
    })
    const daAssinaturaPg = pagamentos.filter(p => String(p.mpPaymentId || '').startsWith('sub_'))
    if (daAssinaturaPg.length) ok(`${daAssinaturaPg.length} pagamento(s) gravados como cobrança da assinatura.`)
    else info('nenhum pagamento gravado ainda como cobrança da assinatura (o 1º pode ter entrado como avulso).')

    // [6] o acesso cobre até a próxima cobrança?
    console.log('\n  [6] O acesso da cliente cobre até a próxima cobrança?')
    const proxima = proximaMp || sub.nextChargeAt
    if (!proxima) {
      info('sem data de próxima cobrança — nada a comparar.')
    } else if (!user.accessExpiresAt || new Date(user.accessExpiresAt) >= new Date(proxima)) {
      ok(`acesso até ${fmt(user.accessExpiresAt)} cobre a cobrança de ${fmt(proxima)}.`)
    } else {
      nao(`acesso vence ${fmt(user.accessExpiresAt)} ANTES da cobrança de ${fmt(proxima)}.`)
      info('A reconciliação horária estende sozinha (subscription_access_extended).')
      info('Se não estender em 1h, é sinal de que ela não está rodando neste ambiente')
      info('(BILLING_WEBHOOK_AUTOPROCESS precisa estar "true" no .env).')
    }

    const estendidos = await db.analyticsEvent.count({
      where: { userId: user.id, event: 'subscription_access_extended', createdAt: { gte: desde } },
    }).catch(() => 0)
    if (estendidos > 0) info(`a rede de segurança já estendeu o acesso ${estendidos}x na janela — o aviso de renovação está se perdendo.`)

    console.log('\n  Veredito:')
    if (isSubscriptionActive(statusMp || sub.status) && (proximaMp || sub.nextChargeAt)) {
      console.log('    A cobrança automática está armada no Mercado Pago.')
      console.log('    O que resta provar só no mês que vem é a cobrança em si —')
      console.log('    e para isso existe a rede de segurança do item [6].')
    } else {
      console.log('    A cobrança automática NÃO está armada. Ver os itens marcados com ✗.')
    }
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect())
