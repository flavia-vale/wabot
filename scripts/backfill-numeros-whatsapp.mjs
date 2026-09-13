#!/usr/bin/env node
// Traz para o histórico de números os que JÁ ESTÃO gravados nas sessões.
//
// POR QUE ESTE SCRIPT EXISTE (2026-09-10): a tag "número repetido" do admin lê
// `WaPhoneOwnership`, e essa tabela só ganha linha quando um robô CONECTA — ou
// seja, ela nasceu vazia no deploy. Os casos que motivaram a tag (quatro
// pessoas, doze contas) são justamente os que ela NÃO mostra: três daquelas
// contas tiveram o acesso cortado e nunca mais vão conectar, e conta antiga
// abandonada também não. O número dessas contas, porém, está em
// `WaSession.phone` desde sempre.
//
// A NORMALIZAÇÃO E A GRAVAÇÃO SÃO IMPORTADAS DO PRODUTO (`recordPhoneOwnership`),
// nunca reescritas aqui: script que reimplementa a regra passa a discordar dela
// em silêncio, e aí o histórico fica com dois formatos do mesmo número.
//
// Read-only por padrão. Grava só com --aplicar.
//
//   node scripts/backfill-numeros-whatsapp.mjs
//   node scripts/backfill-numeros-whatsapp.mjs --aplicar

import 'dotenv/config'
import db from '../src/db.js'
import { recordPhoneOwnership } from '../src/domain/session/phoneOwnership.js'
import { normalizeWaPhone } from '../src/domain/session/phoneReuse.js'

const aplicar = process.argv.includes('--aplicar')

function agrupaPorNumero(sessoes) {
  const porNumero = new Map()
  for (const s of sessoes) {
    const numero = normalizeWaPhone(s.phone)
    if (!numero) continue
    if (!porNumero.has(numero)) porNumero.set(numero, [])
    porNumero.get(numero).push(s)
  }
  return porNumero
}

async function main() {
  const sessoes = await db.waSession.findMany({
    select: { userId: true, phone: true, updatedAt: true, user: { select: { email: true, name: true } } },
  })

  const porNumero = agrupaPorNumero(sessoes)
  const comNumero = [...porNumero.values()].reduce((soma, lista) => soma + lista.length, 0)

  console.log(`[1] Sessões lidas: ${sessoes.length} | com número utilizável: ${comNumero}`)
  console.log(`    Números distintos: ${porNumero.size}`)
  if (sessoes.length && !comNumero) {
    console.log('    ⚠ Nenhuma sessão tem número gravado — não há o que trazer.')
  }

  const repetidos = [...porNumero.entries()].filter(([, lista]) => lista.length > 1)
  console.log(`\n[2] Números que aparecem em MAIS DE UMA conta: ${repetidos.length}`)
  for (const [numero, lista] of repetidos) {
    const fim = numero.slice(-4)
    console.log(`    ...${fim} → ${lista.length} contas`)
    for (const s of lista) console.log(`        ${s.user?.email ?? s.userId} (${s.user?.name ?? 'sem nome'})`)
  }
  if (!repetidos.length) {
    console.log('    Nenhum. A tag não vai aparecer para ninguém — e está correto.')
  }

  const jaNoHistorico = await db.waPhoneOwnership.count()
  console.log(`\n[3] Linhas já no histórico de números: ${jaNoHistorico}`)

  if (!aplicar) {
    console.log('\nNada foi gravado. Rode de novo com --aplicar para trazer estes números.')
    return
  }

  let gravadas = 0
  let falhas = 0
  for (const [numero, lista] of porNumero) {
    for (const s of lista) {
      try {
        // A data da sessão é o que temos de mais próximo de "quando conectou".
        await recordPhoneOwnership({ db, userId: s.userId, phone: numero, now: s.updatedAt ?? new Date() })
        gravadas += 1
      } catch (err) {
        falhas += 1
        console.log(`    ✗ ${s.user?.email ?? s.userId}: ${err?.message ?? err}`)
      }
    }
  }
  const total = await db.waPhoneOwnership.count()
  console.log(`\n[4] Gravadas: ${gravadas} | falhas: ${falhas} | histórico agora: ${total} linhas`)
}

main()
  .catch(err => {
    // Erro engolido em script de diagnóstico vira conclusão errada (lição do
    // `diag-assinatura-recusada`), então ele aparece inteiro.
    console.error('FALHOU:', err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
