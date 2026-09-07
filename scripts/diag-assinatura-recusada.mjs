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
// Os blocos [3] e [4] perguntam ao Mercado Pago o que ELE registrou, porque a
// repetição de checkout explica a segunda e a terceira tentativa e nunca a
// PRIMEIRA — que é onde mora a causa de verdade. Os dois motivos que só o MP
// sabe:
//
//   [3] o motivo exato da recusa. O aviso de pagamento já chega e é gravado
//       cru em `WebhookEvent`, mas o processamento só trata aprovado e
//       estornado: recusado cai fora dos dois ramos, não vira linha em
//       `Payment` e o `status_detail` é descartado. Aqui ele é lido de volta.
//   [4] se algum cartão chegou a ser vinculado ao checkout (`card_id`), se
//       houve cobrança (`summarized.charged_quantity`) e QUANDO o MP encerrou
//       de verdade (`last_modified`) — a hora que aparece no nosso banco é a
//       da passada horária, não a do MP.
//
// `--no-live` pula as consultas ao Mercado Pago (só banco).
// Não imprime segredo nenhum: da chave só sai o MODO (teste/produção).
import 'dotenv/config'
import db from '../src/db.js'
import { classifyMpAccessTokenMode } from '../src/domain/payments/accessTokenMode.js'
import { decidePendingSubscriptionReuse, SUBSCRIPTION_ATTEMPT_WINDOW_MS } from '../src/domain/payments/subscriptionPolicy.js'

const args = process.argv.slice(2)
const dias = Math.max(1, Number((args.find(a => a.startsWith('--days=')) || '').split('=')[1] || 7))
const alvo = args.find(a => !a.startsWith('--')) || null
const semLive = args.includes('--no-live')
const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

// Horário em UTC, como está gravado no banco. Marcado de propósito: os mesmos
// três checkouts aparecem como 09:05/09:08/10:02 no RCA (Brasília) e como
// 12:05/12:08/13:02 aqui, e sem a marca isso parece checkout diferente.
function fmt(d) {
  return d ? `${new Date(d).toISOString().slice(0, 19).replace('T', ' ')}Z` : '—'
}

const MP_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim()

// Somente leitura. Nunca imprime a chave — só o resultado da consulta.
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

// O que cada motivo do MP significa E o que fazer. Sem isso o código cru não
// diz para ninguém se a ação é nossa ou da cliente.
const MOTIVOS = {
  accredited: 'aprovado — o dinheiro entrou',
  pending_contingency: 'em análise pelo MP — costuma resolver sozinho',
  pending_review_manual: 'em análise manual pelo MP',
  cc_rejected_high_risk: 'O MERCADO PAGO barrou por suspeita (antifraude). NÃO foi o banco dela. Ação nossa: não deixar repetir tentativa idêntica; ação dela: pagar do aparelho/cartão que ela costuma usar',
  cc_rejected_duplicated_payment: 'o MP entendeu como cobrança repetida. Ação nossa: espaçar as tentativas',
  cc_rejected_insufficient_amount: 'sem limite ou saldo. Ação dela: outro cartão',
  cc_rejected_call_for_authorize: 'o banco quer que ela autorize a compra. Ação dela: ligar para o banco e liberar',
  cc_rejected_card_disabled: 'cartão não habilitado para compra on-line. Ação dela: falar com o banco',
  cc_rejected_card_type_not_allowed: 'esse tipo de cartão não é aceito. Ação dela: usar cartão de crédito',
  cc_rejected_invalid_installments: 'o parcelamento pedido não é aceito nesse cartão',
  cc_rejected_max_attempts: 'tentativas demais no mesmo cartão. Ação dela: esperar e usar outro',
  cc_rejected_blacklist: 'recusado por restrição do próprio MP. Ação dela: falar com o Mercado Pago',
  cc_rejected_other_reason: 'o banco recusou sem dizer o motivo. Ação dela: outro cartão ou o pagamento avulso',
  cc_rejected_bad_filled_card_number: 'número do cartão digitado errado',
  cc_rejected_bad_filled_date: 'validade digitada errada',
  cc_rejected_bad_filled_security_code: 'código de segurança digitado errado',
  cc_rejected_bad_filled_other: 'algum dado do cartão digitado errado',
}

function explicarMotivo(detalhe) {
  if (!detalhe) return 'o MP não informou o motivo'
  return MOTIVOS[detalhe] || `motivo fora da nossa lista ("${detalhe}") — conferir na tabela de recusas do MP`
}

/**
 * Maior número de checkouts do MESMO plano criados dentro de uma janela — a
 * mesma da regra de espera (`SUBSCRIPTION_ATTEMPT_WINDOW_MS`), para o
 * diagnóstico não usar critério próprio.
 */
function maiorRepeticaoNaJanela(lista) {
  const ordenada = [...lista]
    .filter(s => s.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  let melhor = { total: 0, plan: null, minutos: 0 }
  for (let i = 0; i < ordenada.length; i++) {
    const inicio = new Date(ordenada[i].createdAt).getTime()
    let total = 0
    let fim = inicio
    for (let j = i; j < ordenada.length; j++) {
      const quando = new Date(ordenada[j].createdAt).getTime()
      if (quando - inicio > SUBSCRIPTION_ATTEMPT_WINDOW_MS) break
      if (String(ordenada[j].plan) !== String(ordenada[i].plan)) continue
      total++
      fim = quando
    }
    if (total > melhor.total) {
      melhor = { total, plan: ordenada[i].plan, minutos: Math.round((fim - inicio) / 60000) }
    }
  }
  return melhor
}

function idDoAviso(aviso) {
  if (aviso?.dataId) return String(aviso.dataId)
  try {
    const corpo = JSON.parse(aviso?.payload || '{}')
    const id = corpo?.data?.id ?? corpo?.resource
    return id ? String(id).split('/').pop() : null
  } catch {
    return null
  }
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
  let idsAlvo = null
  if (alvo) {
    // `contactPhone` é o nome real da coluna. Com `phone` a consulta INTEIRA
    // era recusada pelo Prisma e o `catch` devolvia lista vazia — o script
    // dizia "nenhuma conta" para uma conta que existe, com esse e-mail exato.
    // Por isso o erro agora aparece em vez de virar resposta.
    const users = await db.user.findMany({
      where: {
        OR: [
          { email: { contains: alvo } },
          { contactPhone: { contains: alvo } },
          { name: { contains: alvo } },
        ],
      },
      select: { id: true, email: true, name: true },
    }).catch(err => {
      console.log(`\n  Falha ao procurar a conta: ${err?.message || err}`)
      return []
    })
    if (!users.length) {
      // Sem `return`: os avisos do Mercado Pago vivem em `WebhookEvent`, que
      // NÃO tem vínculo com a conta e sobrevive ao apagamento dela. Desistir
      // aqui jogaria fora justamente o registro que ainda existe.
      console.log(`\nNenhuma conta com "${alvo}" no banco.`)
      console.log('  Pode ser grafia diferente (tente um pedaço: "vitorio"), outro e-mail no cadastro,')
      console.log('  ou conta apagada. Seguindo SEM filtro de conta — os avisos do Mercado Pago')
      console.log('  continuam no banco mesmo que a conta não exista mais.')
    } else {
      console.log(`\nContas: ${users.map(u => u.email || u.name || u.id).join(', ')}`)
      idsAlvo = users.map(u => u.id)
      where = { ...where, userId: { in: idsAlvo } }
    }
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
    // A repetição é medida por checkouts CRIADOS na mesma janela, nunca pelos
    // que continuam em aberto agora: a reconciliação horária encerra os
    // anteriores, e contando o estado atual três tentativas em 57 minutos
    // apareciam como "sem repetição" — foi o que fez o script concluir que a
    // recusa tinha vindo do cartão da cliente. Mesma janela da regra de espera,
    // para diagnóstico e produto não discordarem.
    const repeticao = maiorRepeticaoNaJanela(lista)
    const repetido = repeticao.total >= 2
    if (repetido) suspeitas++
    console.log(`\n  ${rotulo} — ${lista.length} checkout(s), ${pendentes.length} em aberto${repetido ? `   << ${repeticao.total} tentativas do plano ${repeticao.plan} em ${repeticao.minutos} min` : ''}`)
    for (const s of lista) {
      const decisao = decidePendingSubscriptionReuse({ subscription: s, plan: s.plan })
      console.log(`    ${fmt(s.createdAt)}  plano=${String(s.plan).padEnd(6)} situacao=${String(s.status).padEnd(10)} reaproveitavel=${decisao.reuse ? 'sim' : `nao (${decisao.reason})`}`)
    }
  }

  if (suspeitas > 0) {
    console.log(`\n>> ${suspeitas} conta(s) com checkouts repetidos e idênticos — o padrão que o antifraude do MP recusa.`)
  }

  // ---- Causa 3: o motivo que só o Mercado Pago sabe ----------------------
  // A repetição explica a segunda e a terceira tentativa; a PRIMEIRA, não. O
  // aviso de pagamento chega e é gravado cru, mas quem processa só trata
  // aprovado e estornado — recusado some sem deixar linha. Aqui ele volta.
  const recusas = []
  console.log(`\n[3] Motivo da recusa, direto do Mercado Pago`)
  if (semLive) {
    console.log('    (pulado por --no-live)')
  } else if (!MP_TOKEN) {
    console.log('    Sem chave configurada neste ambiente — rode dentro do diretório do ambiente certo.')
  } else {
    // `eventType` vem do corpo do aviso; o formato antigo do MP manda o tipo na
    // query e deixa o campo vazio. Por isso os sem tipo entram também, e a
    // separação real é o formato do id: pagamento é numérico, assinatura não.
    const avisos = await db.webhookEvent.findMany({
      where: {
        provider: 'mercado_pago',
        createdAt: { gte: desde },
        OR: [{ eventType: 'payment' }, { eventType: null }],
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, dataId: true, payload: true },
      take: 300,
    }).catch(() => [])

    const ids = [...new Set(avisos.map(idDoAviso).filter(id => id && /^\d+$/.test(id)))].slice(0, 60)
    console.log(`    ${avisos.length} aviso(s) de pagamento recebido(s), ${ids.length} pagamento(s) distinto(s) a consultar.`)

    if (!ids.length) {
      console.log('    >> NENHUM aviso de pagamento na janela.')
      console.log('       Isso é um achado, não um vazio: se nenhum pagamento foi sequer tentado, a recusa')
      console.log('       aconteceu ANTES da cobrança e a teoria de "cobrança recusada" não se sustenta.')
      console.log('       Confira também se o evento `payment` está marcado no painel do Mercado Pago.')
    }

    for (const id of ids) {
      const r = await mpGet(`/v1/payments/${id}`)
      if (!r.ok) {
        console.log(`    ${id}: não deu para consultar (${r.motivo})`)
        continue
      }
      const pag = r.corpo || {}
      const dono = pag.external_reference ? String(pag.external_reference) : null
      if (idsAlvo && dono && !idsAlvo.includes(dono)) continue

      const situacao = String(pag.status || '?')
      // De quem é: a conta no nosso banco quando ela existe; senão o e-mail que
      // o MP guardou. Sem isso, uma varredura sem filtro lista recusas anônimas
      // e não dá para saber qual cliente chamar.
      let dequem = pag.payer?.email || 'pagador não informado'
      if (dono) {
        const u = await db.user.findUnique({ where: { id: dono }, select: { email: true, name: true } }).catch(() => null)
        if (u) dequem = u.email || u.name || dono
        else dequem += ' (conta não existe mais no nosso banco)'
      }
      console.log(`    ${fmt(pag.date_created)}  R$${pag.transaction_amount ?? '?'}  ${situacao.toUpperCase()}  ${dequem}`)
      console.log(`        ${explicarMotivo(pag.status_detail)}`)
      if (situacao === 'rejected') recusas.push({ id, detalhe: pag.status_detail, quando: pag.date_created })
    }
  }

  // ---- Causa 4: o checkout chegou a receber um cartão? -------------------
  // `card_id`/`payment_method_id` vazios provam que nenhum cartão foi vinculado
  // (ela não concluiu), e `charged_quantity` prova que nada foi cobrado.
  // `last_modified` é a hora em que o MP encerrou de verdade — a do nosso banco
  // é só a da passada horária que copiou o estado.
  console.log(`\n[4] Estado de cada checkout no Mercado Pago`)
  const comId = assinaturas.filter(a => a.mpSubscriptionId).slice(0, 20)
  if (semLive) {
    console.log('    (pulado por --no-live)')
  } else if (!MP_TOKEN) {
    console.log('    Sem chave configurada neste ambiente.')
  } else if (!comId.length) {
    console.log('    Nenhum checkout com identificador do Mercado Pago na janela.')
  } else {
    for (const a of comId) {
      const r = await mpGet(`/preapproval/${a.mpSubscriptionId}`)
      if (!r.ok) {
        console.log(`    ${fmt(a.createdAt)}  ${a.mpSubscriptionId}: não deu para consultar (${r.motivo})`)
        continue
      }
      const c = r.corpo || {}
      const cartao = c.card_id || c.payment_method_id
      const cobrancas = c.summarized?.charged_quantity ?? 0
      console.log(`    ${fmt(a.createdAt)}  situacao=${String(c.status || '?').padEnd(10)} cartao=${cartao ? 'vinculado' : 'NENHUM'} cobrancas=${cobrancas} encerrado_em=${fmt(c.last_modified)}`)
    }
    console.log('    (cartao=NENHUM significa que ela não chegou a concluir o checkout — nada foi cobrado.)')
  }

  // ---- Conclusão ---------------------------------------------------------
  console.log('')
  if (recusas.length) {
    const antifraude = recusas.filter(r => r.detalhe === 'cc_rejected_high_risk' || r.detalhe === 'cc_rejected_duplicated_payment')
    if (antifraude.length) {
      console.log(`>> CAUSA ENCONTRADA: ${antifraude.length} recusa(s) do antifraude do Mercado Pago.`)
      console.log('   Não é o cartão dela. Ação nossa: não deixar repetir tentativa idêntica.')
      console.log('   Ação com ela: tentar do aparelho e do cartão que ela costuma usar, ou o pagamento avulso.')
    } else {
      console.log(`>> CAUSA ENCONTRADA: ${recusas.length} recusa(s), motivo do banco/cartão — ver as linhas do bloco [3].`)
      console.log('   Ação com ela: outro cartão, ou o pagamento avulso.')
    }
  } else if (suspeitas > 0) {
    console.log('>> Há repetição de checkout, mas nenhuma recusa registrada na janela.')
    console.log('   Amplie a janela com --days ou confirme se o evento `payment` está marcado no painel do MP.')
  } else if (assinaturas.length) {
    console.log('>> Sem repetição de checkout, sem chave de teste e sem recusa registrada.')
    console.log('   O caminho mais provável é ela não ter concluído o checkout — confira `cartao=` no bloco [4].')
  }
}

main()
  .catch(err => { console.error('Falhou:', err?.message || err); process.exitCode = 1 })
  .finally(() => db.$disconnect().catch(() => {}))
