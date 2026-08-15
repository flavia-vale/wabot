#!/usr/bin/env node
/* De onde vieram os clientes? (read-only)
 *
 * Responde a pergunta "chegou cliente por SEO?" com dado, não com impressão.
 * Roda no VPS, dentro do diretório do ambiente:
 *
 *   cd ~/wabot          && node scripts/diag-lead-origin.mjs --days 180
 *   cd ~/wabot-staging  && node scripts/diag-lead-origin.mjs --days 180
 *
 * Só lê. Não imprime e-mail, telefone nem qualquer dado pessoal — o usuário
 * aparece como prefixo de id, o suficiente para cruzar com o painel admin.
 *
 * ⚠️ Por que NÃO agrupamos por utm_source: os próprios botões do site carimbam
 * `utm_medium=organic` (ver src/marketing/leadOrigin.js). Agrupar por utm daria
 * "quase tudo orgânico" e mandaria investir no canal errado. A classificação
 * usa código de parceiro > código de indicação > primeira página visitada.
 */
import { PrismaClient } from '@prisma/client'
import {
  LEAD_ORIGINS,
  LEAD_ORIGIN_LABELS,
  parseEventMetadata,
  summarizeLeadOrigins,
} from '../src/marketing/leadOrigin.js'

const prisma = new PrismaClient()

// Eventos que provam que a pessoa saiu do papel (ativação real, não só cadastro).
const ACTIVATION_EVENTS = ['whatsapp_connected', 'first_send_success']

function parseArgs(argv) {
  const args = { days: 180 }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--days') args.days = Number(argv[i + 1] || args.days)
  }
  return args
}

function pct(part, total) {
  if (!total) return '—'
  return `${((part / total) * 100).toFixed(0)}%`
}

function pad(value, width) {
  const text = String(value)
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

function padLeft(value, width) {
  const text = String(value)
  return text.length >= width ? text : ' '.repeat(width - text.length) + text
}

async function loadUserIdsForEvents(events, from) {
  const rows = await prisma.analyticsEvent.findMany({
    where: { event: { in: events }, createdAt: { gte: from }, userId: { not: null } },
    select: { userId: true },
  })
  return new Set(rows.map((row) => row.userId))
}

async function main() {
  const { days } = parseArgs(process.argv.slice(2))
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [signupRows, totalUsers, usersInWindow] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { event: 'signup_created', createdAt: { gte: from } },
      select: { userId: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: from } } }),
  ])

  const [activatedUserIds, payingUserIds] = await Promise.all([
    loadUserIdsForEvents(ACTIVATION_EVENTS, from),
    loadUserIdsForEvents(['payment_approved'], from),
  ])

  const signups = signupRows.map((row) => ({
    userId: row.userId,
    metadata: parseEventMetadata(row.metadata),
  }))

  const summary = summarizeLeadOrigins(signups, activatedUserIds, payingUserIds)
  const totalSignups = signups.length

  console.log(`\n=== ORIGEM DOS CADASTROS — últimos ${days} dias ===`)
  console.log(`Janela desde: ${from.toISOString().slice(0, 10)}`)
  console.log(`Cadastros com evento de atribuição: ${totalSignups}`)
  console.log(`Usuários criados na janela (tabela User): ${usersInWindow}`)
  console.log(`Usuários no total (desde sempre): ${totalUsers}`)

  if (usersInWindow > totalSignups) {
    console.log(
      `\n⚠️  ${usersInWindow - totalSignups} usuário(s) da janela não têm evento de cadastro.\n` +
        '   São anteriores ao rastreio ou o evento falhou. Eles NÃO entram na conta\n' +
        '   por origem — contá-los como SEO inflaria o canal.',
    )
  }

  if (!totalSignups) {
    console.log('\nNenhum cadastro com atribuição na janela. Aumente --days.')
    return
  }

  console.log('\n' + pad('ORIGEM', 46) + padLeft('CADASTROS', 11) + padLeft('ATIVARAM', 11) + padLeft('PAGARAM', 10))
  console.log('-'.repeat(78))
  for (const row of summary) {
    const label = LEAD_ORIGIN_LABELS[row.origin] ?? row.origin
    console.log(
      pad(label.slice(0, 45), 46) +
        padLeft(`${row.signups} (${pct(row.signups, totalSignups)})`, 11) +
        padLeft(`${row.activated} (${pct(row.activated, row.signups)})`, 11) +
        padLeft(`${row.paying} (${pct(row.paying, row.signups)})`, 10),
    )
  }

  const content = summary.find((row) => row.origin === LEAD_ORIGINS.CONTENT)
  if (content?.landingPages.length) {
    console.log('\n--- Páginas que trouxeram cadastro (primeira página visitada) ---')
    for (const page of content.landingPages) {
      console.log(`  ${padLeft(page.count, 4)}  ${page.path}`)
    }
    console.log(
      '\n  Estas são as páginas que merecem investimento: já provaram que\n' +
        '  convertem, não só que recebem visita.',
    )
  } else {
    console.log('\n--- Nenhum cadastro teve conteúdo como primeira página. ---')
    console.log('  Ou seja: não há evidência de cliente vindo de descoberta por busca.')
  }

  // Origem do TRÁFEGO (não do cadastro): só existe desde 2026-08-04 e é anônimo,
  // então não dá para cruzar com usuário. Serve para saber se busca traz visita.
  const referralRows = await prisma.analyticsEvent.findMany({
    where: { event: 'referral_visit', createdAt: { gte: from } },
    select: { metadata: true },
  })
  if (referralRows.length) {
    const byKind = new Map()
    const byHost = new Map()
    for (const row of referralRows) {
      const meta = parseEventMetadata(row.metadata)
      const kind = String(meta.referrer_kind || 'desconhecido')
      const host = String(meta.referrer_host || 'desconhecido')
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
      byHost.set(host, (byHost.get(host) ?? 0) + 1)
    }
    console.log(`\n--- Visitas vindas de fora (${referralRows.length} no período) ---`)
    for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${padLeft(count, 5)}  ${kind}`)
    }
    console.log('  Top origens:')
    for (const [host, count] of [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`  ${padLeft(count, 5)}  ${host}`)
    }
  } else {
    console.log('\n--- Nenhuma visita externa registrada no período. ---')
    console.log('  O rastreio de origem de visita começou em 2026-08-04; antes disso não há dado.')
  }

  console.log(
    '\nComo ler: "conteúdo" é o sinal mais próximo de descoberta por busca —\n' +
      'a pessoa caiu num artigo antes de conhecer a marca. "home" significa que\n' +
      'ela já sabia o nome (indicação boca a boca, Instagram, print no grupo).\n' +
      'Para confirmar, cruze as páginas acima com os cliques do Search Console.\n',
  )
}

main()
  .catch((err) => {
    console.error('[diag-lead-origin] falhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
