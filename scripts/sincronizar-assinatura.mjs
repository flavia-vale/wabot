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
import { createMpGet, planSync, applySync } from '../src/domain/payments/subscriptionSync.js'

const args = process.argv.slice(2)
const alvo = args.find(a => !a.startsWith('--')) || null
const aplicar = args.includes('--aplicar')
const MP_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim()

function fmt(d) {
  return d ? `${new Date(d).toISOString().slice(0, 19).replace('T', ' ')}Z` : '—'
}

const mpGet = createMpGet({ token: MP_TOKEN })

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

    // Mesma lógica da ficha do cliente no painel: planSync lê, applySync grava.
    const plano = await planSync({ db, userId: user.id, mpGet })
    if (!plano.hasSubscriptions) {
      console.log('    nenhuma assinatura recorrente registrada (só pagamento avulso).')
      continue
    }
    for (const item of plano.items) {
      console.log(`\n    assinatura ${item.plan}`)
      console.log(`      aqui no nosso banco: ${item.storedStatus} · próxima cobrança ${fmt(item.storedNextChargeAt)}`)
      if (item.action === 'unreachable') {
        console.log(`      no Mercado Pago: não consegui consultar (${item.reason})`)
        continue
      }
      console.log(`      no Mercado Pago: ${item.mpStatus || '?'} — ${item.explanation}`)
      console.log(`      cobranças já feitas: ${item.mpCharged ?? '—'} · próxima cobrança ${fmt(item.mpNextChargeAt)}`)
      if (item.action === 'none') {
        console.log('      >> nosso banco já bate com o Mercado Pago.')
        continue
      }
      console.log(`      >> DIVERGÊNCIA: aqui está "${item.storedStatus}" e no Mercado Pago está "${item.newStatus}".`)
      if (!aplicar) console.log('         Rode de novo com --aplicar para acertar (grava o que o MP respondeu).')
    }
    if (aplicar && plano.pending > 0) {
      const feito = await applySync({ db, userId: user.id, shown: plano, mpGet })
      console.log(`\n    corrigidas: ${feito.applied} · mudaram no meio do caminho (não gravadas): ${feito.stale}`)
    }
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect())
