#!/usr/bin/env node
// "Seu pagamento foi recusado" no checkout de ASSINATURA — read-only.
//
//   cd ~/wabot && node scripts/diag-assinatura-recusada.mjs [<email|telefone|nome>] [--days=7]
//
// A tela de recusa do Mercado Pago é a MESMA para causas com ações opostas.
// Este script separa as três que dependem de nós:
//
//   1. chave de TESTE em produção  -> nenhum cartão real é aceito, e não é o
//      cartão da cliente que está errado;
//   2. checkouts repetidos e idênticos -> o antifraude do MP lê como cobrança
//      duplicada e recusa (é a causa que o reaproveitamento de checkout fecha);
//   3. nada disso -> a recusa veio do banco/cartão da cliente mesmo, e a ação
//      é ela usar outro meio de pagamento.
//
// Não imprime segredo nenhum: da chave só sai o MODO (teste/produção).
import 'dotenv/config'
import db from '../src/db.js'
import { classifyMpAccessTokenMode } from '../src/domain/payments/accessTokenMode.js'
import { decidePendingSubscriptionReuse } from '../src/domain/payments/subscriptionPolicy.js'

const args = process.argv.slice(2)
const dias = Math.max(1, Number((args.find(a => a.startsWith('--days=')) || '').split('=')[1] || 7))
const alvo = args.find(a => !a.startsWith('--')) || null
const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

function fmt(d) {
  return d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : '—'
}

async function main() {
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}`)

  // ---- Causa 1: chave de teste em produção -------------------------------
  const modo = classifyMpAccessTokenMode(process.env.MP_ACCESS_TOKEN)
  const ehProducao = (process.env.APP_ENV || process.env.NODE_ENV) === 'production'
  console.log(`\n[1] Chave do Mercado Pago: modo ${modo.toUpperCase()}${ehProducao ? ' · host de produção' : ''}`)
  if (ehProducao && modo === 'test') {
    console.log('    >> CAUSA ENCONTRADA: chave de TESTE em produção. NENHUM cartão real é aceito.')
    console.log('       Troque MP_ACCESS_TOKEN pelo token APP_USR-... e aplique com pm2 delete + start.')
  } else if (modo === 'missing') {
    console.log('    >> MP_ACCESS_TOKEN ausente — o checkout nem chega a ser criado.')
  } else if (ehProducao && modo === 'unknown') {
    console.log('    (prefixo fora do padrão do MP — confira manualmente se é o token de produção)')
  } else {
    console.log('    ok — a chave não explica a recusa.')
  }

  // ---- Causa 2: checkouts repetidos --------------------------------------
  let where = { createdAt: { gte: desde } }
  if (alvo) {
    const users = await db.user.findMany({
      where: { OR: [{ email: { contains: alvo } }, { phone: { contains: alvo } }, { name: { contains: alvo } }] },
      select: { id: true, email: true, name: true },
    }).catch(() => [])
    if (!users.length) {
      console.log(`\nNenhuma conta encontrada para "${alvo}".`)
      return
    }
    console.log(`\nContas: ${users.map(u => u.email || u.name || u.id).join(', ')}`)
    where = { ...where, userId: { in: users.map(u => u.id) } }
  }

  const assinaturas = await db.subscription.findMany({
    where,
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, userId: true, plan: true, status: true, mpSubscriptionId: true, createdAt: true, updatedAt: true },
  }).catch(() => [])

  console.log(`\n[2] Checkouts de assinatura criados nos últimos ${dias} dia(s): ${assinaturas.length}`)

  const porConta = new Map()
  for (const s of assinaturas) {
    if (!porConta.has(s.userId)) porConta.set(s.userId, [])
    porConta.get(s.userId).push(s)
  }

  let suspeitas = 0
  for (const [userId, lista] of porConta) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }).catch(() => null)
    const rotulo = user?.email || user?.name || userId
    const pendentes = lista.filter(s => String(s.status).toLowerCase() === 'pending')
    // Duas ou mais tentativas idênticas em aberto é exatamente o padrão que o
    // antifraude do MP recusa. Uma tentativa só nunca é este caso.
    const repetido = pendentes.length >= 2
    if (repetido) suspeitas++
    console.log(`\n  ${rotulo} — ${lista.length} checkout(s), ${pendentes.length} em aberto${repetido ? '   << PADRÃO DE RECUSA POR REPETIÇÃO' : ''}`)
    for (const s of lista) {
      const decisao = decidePendingSubscriptionReuse({ subscription: s, plan: s.plan })
      console.log(`    ${fmt(s.createdAt)}  plano=${String(s.plan).padEnd(6)} situacao=${String(s.status).padEnd(10)} reaproveitavel=${decisao.reuse ? 'sim' : `nao (${decisao.reason})`}`)
    }
  }

  console.log('')
  if (suspeitas > 0) {
    console.log(`>> ${suspeitas} conta(s) com checkouts repetidos e idênticos — causa 2 confirmada.`)
    console.log('   A correção (reaproveitar o checkout em aberto) só passa a valer depois do deploy da API.')
  } else if (assinaturas.length) {
    console.log('>> Sem repetição de checkout e sem chave de teste: a recusa veio do cartão/banco da cliente.')
    console.log('   Ação com ela: outro cartão, ou o pagamento avulso.')
  }
}

main()
  .catch(err => { console.error('Falhou:', err?.message || err); process.exitCode = 1 })
  .finally(() => db.$disconnect().catch(() => {}))
