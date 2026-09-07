#!/usr/bin/env node
// "Assinou recorrente e o painel diz que ela não terminou" — confere no
// Mercado Pago o que a assinatura REALMENTE é e, com `--aplicar`, grava aqui.
//
//   cd ~/wabot && node scripts/sincronizar-assinatura.mjs <email> [--aplicar]
//
// Por que existe: o aviso da COBRANÇA do MP liberava o acesso e não encostava
// no status da assinatura, e quem sincroniza o status só passa de hora em
// hora. Resultado: conta cobrando todo mês marcada como `pending`, painel
// dizendo "você começou e não terminou" e admin dizendo "falta concluir" para
// quem já pagou. Este script responde a pergunta que importa — "a cliente
// precisa fazer alguma coisa no Mercado Pago?" — sem entrar no painel do MP.
//
// Sem `--aplicar` é SÓ LEITURA. Nunca imprime a chave do Mercado Pago.
import 'dotenv/config'
import db from '../src/db.js'
import { decideSubscriptionStatusFromCharge } from '../src/domain/payments/subscriptionPolicy.js'

const args = process.argv.slice(2)
const alvo = args.find(a => !a.startsWith('--')) || null
const aplicar = args.includes('--aplicar')
const MP_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim()

function fmt(d) {
  return d ? `${new Date(d).toISOString().slice(0, 19).replace('T', ' ')}Z` : '—'
}

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

const TRADUCAO = {
  authorized: 'VALENDO — o Mercado Pago cobra sozinho todo mês. A cliente não precisa fazer nada.',
  pending: 'EM ABERTO no Mercado Pago — o checkout nasceu e ninguém concluiu.',
  paused: 'PAUSADA no Mercado Pago.',
  cancelled: 'CANCELADA no Mercado Pago.',
}

async function main() {
  if (!alvo) {
    console.log('Uso: node scripts/sincronizar-assinatura.mjs <email> [--aplicar]')
    process.exit(1)
  }

  const users = await db.user.findMany({
    where: { OR: [{ email: { contains: alvo } }, { contactPhone: { contains: alvo } }, { name: { contains: alvo } }] },
    select: { id: true, email: true, name: true, plan: true, accessExpiresAt: true },
  }).catch(err => {
    // Erro engolido em script de diagnóstico vira conclusão errada — imprime.
    console.log(`Falha ao procurar a conta: ${err?.message || err}`)
    return []
  })
  if (!users.length) {
    console.log(`Nenhuma conta com "${alvo}".`)
    return
  }

  for (const user of users) {
    console.log(`\n=== ${user.email || user.name || user.id}`)
    console.log(`    plano ${user.plan} · acesso até ${fmt(user.accessExpiresAt)}`)

    const pagamentos = await db.payment.findMany({
      where: { userId: user.id, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { amount: true, createdAt: true, mpPaymentId: true },
    })
    console.log(`    pagamentos aprovados (últimos ${pagamentos.length}):`)
    for (const p of pagamentos) {
      // `sub_` no identificador = cobrança da assinatura recorrente.
      const origem = String(p.mpPaymentId || '').startsWith('sub_') ? 'assinatura' : 'avulso'
      console.log(`      ${fmt(p.createdAt)} · R$ ${p.amount} · ${origem}`)
    }

    const assinaturas = await db.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    if (!assinaturas.length) {
      console.log('    nenhuma assinatura recorrente registrada (só pagamento avulso).')
      continue
    }

    for (const sub of assinaturas) {
      console.log(`\n    assinatura ${sub.plan} criada em ${fmt(sub.createdAt)}`)
      console.log(`      aqui no nosso banco: ${sub.status} · próxima cobrança ${fmt(sub.nextChargeAt)}`)

      const resposta = await mpGet(`/preapproval/${sub.mpSubscriptionId}`)
      if (!resposta.ok) {
        console.log(`      no Mercado Pago: não consegui consultar (${resposta.motivo})`)
        continue
      }
      const status = String(resposta.corpo?.status || '').toLowerCase()
      const proxima = resposta.corpo?.next_payment_date || resposta.corpo?.auto_recurring?.next_payment_date || null
      const cobradas = resposta.corpo?.summarized?.charged_quantity ?? null
      console.log(`      no Mercado Pago: ${status || '?'} — ${TRADUCAO[status] || 'status fora da lista conhecida'}`)
      console.log(`      cobranças já feitas: ${cobradas ?? '—'} · próxima cobrança ${fmt(proxima)}`)

      const decisao = decideSubscriptionStatusFromCharge({ storedStatus: sub.status, snapshotStatus: status })
      if (!decisao.update) {
        console.log('      >> nosso banco já bate com o Mercado Pago.')
        continue
      }
      console.log(`      >> DIVERGÊNCIA: aqui está "${sub.status}" e no Mercado Pago está "${decisao.status}".`)
      if (!aplicar) {
        console.log('         Rode de novo com --aplicar para acertar (grava o que o MP respondeu).')
        continue
      }
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: decisao.status, nextChargeAt: proxima ? new Date(proxima) : sub.nextChargeAt ?? null },
      })
      console.log('         corrigido.')
    }
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect())
