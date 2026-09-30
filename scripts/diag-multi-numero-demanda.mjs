#!/usr/bin/env node
// Procura por "vários números na mesma conta" — read-only, roda no diretório do ambiente.
//
//   cd ~/wabot && node scripts/diag-multi-numero-demanda.mjs
//   cd ~/wabot && node scripts/diag-multi-numero-demanda.mjs --lista   # + e-mails da lista (contato de pré-venda)
//
// POR QUE ESTE SCRIPT EXISTE (2026-09-30)
// ---------------------------------------
// Fase 0 do plano em docs/rca/multi-numero.md: só escrever a parte técnica
// (número reserva, rodízio) se a procura for real. Ele responde três perguntas:
//   1. Quantas contas PRO ativas existem (a base do "10% dos PROs").
//   2. Quem entrou na lista de espera, pedindo quantos números e por quê.
//   3. Quantas pessoas JÁ usam várias contas com o mesmo número (sinal de
//      procura que hoje não gera receita a mais — ou que a gente pode perder).
// E imprime a decisão: seguir ou não para a Fase 1.
//
// Read-only: só `findMany`/`count`. A regra de "intenção vigente" e o critério
// de decisão são IMPORTADOS de src/domain/multiNumber/waitlist.js — a mesma
// regra da rota. Não reescrever aqui.
import 'dotenv/config'
import db from '../src/db.js'
import {
  MULTI_NUMBER_WAITLIST_EVENTS,
  WAITLIST_REASONS,
  currentWaitlistEntry,
  summarizeWaitlist,
  waitlistPlanStatus,
  phaseOneDecision,
  GO_MIN_ACCOUNTS,
  GO_MIN_PRO_SHARE,
  GO_MIN_ACCOUNTS_FOR_SHARE,
} from '../src/domain/multiNumber/waitlist.js'

const listar = process.argv.includes('--lista')
const agora = new Date()
const reais = (cents) => `R$${(cents / 100).toFixed(2).replace('.', ',')}`

const users = await db.user.findMany({
  where: { accessExpiresAt: { gt: agora } },
  select: { id: true, plan: true, accessExpiresAt: true },
})
const ativos = new Map(users.map((u) => [u.id, u]))
const proAtivos = users.filter((u) => !waitlistPlanStatus(u, agora).requiresUpgrade)
const basicAtivos = users.filter((u) => u.plan === 'basic')

console.log('== Base ==')
console.log(`contas com acesso ativo: ${users.length} | PRO/Trial: ${proAtivos.length} | Basic: ${basicAtivos.length}`)

const eventos = await db.analyticsEvent.findMany({
  where: { event: { in: [...MULTI_NUMBER_WAITLIST_EVENTS] } },
  select: { userId: true, event: true, metadata: true, createdAt: true },
})
const porConta = new Map()
for (const e of eventos) {
  if (!e.userId) continue
  if (!porConta.has(e.userId)) porConta.set(e.userId, [])
  porConta.get(e.userId).push(e)
}
const entradas = [...porConta.entries()].map(([userId, evs]) => {
  const atual = currentWaitlistEntry(evs)
  const user = ativos.get(userId)
  return { userId, ...atual, active: Boolean(user), ...waitlistPlanStatus(user ?? {}, agora) }
})
const naLista = entradas.filter((e) => e.joined)
const resumo = summarizeWaitlist(naLista)
const proNaLista = naLista.filter((e) => e.active && !e.requiresUpgrade).length

console.log('\n== Lista de espera ==')
console.log(`contas na lista: ${resumo.accounts} (PRO/Trial ativo: ${proNaLista} | precisam subir de plano ou sem acesso: ${resumo.accounts - proNaLista}) | saíram: ${entradas.length - naLista.length}`)
console.log(`números a mais pedidos: ${resumo.extraNumbersTotal} → receita potencial ${reais(resumo.potentialMonthlyCents)}/mês`)
console.log('por quantidade:', JSON.stringify(resumo.byExtraNumbers), '(4 = 4 ou mais)')
for (const [motivo, n] of Object.entries(resumo.byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${WAITLIST_REASONS[motivo] ?? motivo}`)
}

const donos = await db.waPhoneOwnership.findMany({ select: { phone: true, userId: true } })
const contasPorNumero = new Map()
for (const d of donos) {
  if (!contasPorNumero.has(d.phone)) contasPorNumero.set(d.phone, new Set())
  contasPorNumero.get(d.phone).add(d.userId)
}
const compartilhados = [...contasPorNumero.values()].filter((s) => s.size > 1)
const contasEnvolvidas = new Set(compartilhados.flatMap((s) => [...s]))
const contasEnvolvidasAtivas = [...contasEnvolvidas].filter((id) => ativos.has(id)).length

console.log('\n== Várias contas com o mesmo número (já existe hoje) ==')
console.log(`números em mais de uma conta: ${compartilhados.length} | contas envolvidas: ${contasEnvolvidas.size} (com acesso ativo: ${contasEnvolvidasAtivas})`)
console.log('  (hipótese a confirmar: parte é procura por mais números, parte é reuso de teste grátis)')

const decisao = phaseOneDecision({ proAccounts: proAtivos.length, waitlistProAccounts: proNaLista })
console.log('\n== Decisão Fase 1 (número reserva) ==')
console.log(`PRO na lista: ${decisao.waitlistProAccounts}/${decisao.proAccounts} = ${(decisao.share * 100).toFixed(1)}%`)
console.log(`critério: ≥${GO_MIN_ACCOUNTS} contas PRO OU ≥${GO_MIN_PRO_SHARE * 100}% dos PROs (com ao menos ${GO_MIN_ACCOUNTS_FOR_SHARE})`)
console.log(decisao.go ? 'SEGUIR para a Fase 1.' : 'AINDA NÃO: manter a lista aberta e divulgar.')

if (listar && naLista.length) {
  const contatos = await db.user.findMany({
    where: { id: { in: naLista.map((e) => e.userId) } },
    select: { id: true, email: true, plan: true },
  })
  const porId = new Map(naLista.map((e) => [e.userId, e]))
  console.log('\n== Contatos da lista (pré-venda) ==')
  for (const c of contatos) {
    const e = porId.get(c.id)
    console.log(`${c.email} | plano ${c.plan} | +${e.extraNumbers} | ${WAITLIST_REASONS[e.reason] ?? e.reason}`)
  }
}

await db.$disconnect()
