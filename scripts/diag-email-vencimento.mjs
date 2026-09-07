#!/usr/bin/env node
// "O e-mail de plano vencido está saindo?" — read-only, roda no diretório do
// ambiente.
//
//   cd ~/wabot && node scripts/diag-email-vencimento.mjs
//   cd ~/wabot && node scripts/diag-email-vencimento.mjs <email> --dias=60
//
// Por que existe: até aqui não havia jeito nenhum de responder essa pergunta
// sem entrar no banco na mão. O e-mail podia estar sendo barrado por SEIS
// motivos com ações completamente diferentes — SMTP desligado (nenhum e-mail
// sai, nem este), passada desligada, texto desligado no painel, descadastro,
// janela anti-repetição ou teto diário — e todos aparecem do mesmo jeito para
// quem olha de fora: "não chegou".
//
// Não imprime segredo nenhum: da configuração de SMTP sai só se existe.

import 'dotenv/config'
import db from '../src/db.js'
import { isEmailConfigured } from '../src/email/mailer.js'
import { getTemplateDefinition } from '../src/email/registry.js'
import { EXPIRED_PLAN_JOURNEY, resolveExpiredPlanEmail } from '../src/emailTriggers/expiredPlanJourney.js'
import { daysUntil } from '../src/emailTriggers/lifecyclePolicy.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const PAID_PLANS = new Set(['basic', 'pro'])

const args = process.argv.slice(2)
const alvo = args.find((a) => !a.startsWith('--')) ?? null
const dias = Number((args.find((a) => a.startsWith('--dias=')) ?? '').split('=')[1]) || 30

const now = new Date()
const desde = new Date(now.getTime() - dias * MS_PER_DAY)
const SLUGS = EXPIRED_PLAN_JOURNEY.map((etapa) => etapa.slug)

function titulo(texto) {
  console.log(`\n${texto}\n${'-'.repeat(texto.length)}`)
}

function linha(rotulo, valor) {
  console.log(`  ${String(rotulo).padEnd(34)} ${valor}`)
}

async function main() {
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}`)
  console.log(`Horários em UTC. Janela: ${dias} dias.`)

  // [1] As travas que desligam TUDO de uma vez.
  titulo('[1] O motor está ligado?')
  const smtp = isEmailConfigured()
  linha('SMTP configurado:', smtp ? 'sim' : 'NÃO → nenhum e-mail sai, nem este')
  const passada = String(process.env.LIFECYCLE_EMAIL_ENABLED ?? '').trim().toLowerCase() !== 'false'
  linha('Passada diária ligada:', passada ? 'sim' : 'NÃO (LIFECYCLE_EMAIL_ENABLED=false)')
  if (!smtp) {
    console.log('\n  → Esta é a explicação mais provável. Sem SMTP_* no .env o envio é')
    console.log('    no-op silencioso: nada é gravado como enviado nem como barrado.')
  }

  // [2] Alguém desligou o texto pelo painel? Override é a causa mais fácil de
  //     esquecer, porque não aparece em lugar nenhum do log.
  titulo('[2] Os textos da jornada estão ligados?')
  for (const etapa of EXPIRED_PLAN_JOURNEY) {
    const definition = getTemplateDefinition(etapa.slug)
    const override = await db.emailTemplate.findUnique({ where: { slug: etapa.slug } }).catch(() => null)
    const estado = override && override.enabled === false ? 'DESLIGADO no painel' : 'ligado'
    const editado = override ? ' (texto editado no painel)' : ''
    linha(`dia ${etapa.de}-${etapa.ate} · ${etapa.slug}`, `${estado}${editado} · ${definition ? definition.category : 'SEM TEXTO NO CATÁLOGO'}`)
  }

  // [3] O que de fato saiu (ou foi barrado, e por quê).
  titulo(`[3] O que aconteceu com esses e-mails nos últimos ${dias} dias`)
  const historico = await db.emailSendLog.groupBy({
    by: ['slug', 'status', 'skipReason'],
    where: { slug: { in: SLUGS }, createdAt: { gte: desde } },
    _count: { _all: true },
  }).catch((err) => {
    console.log(`  (falha ao ler o histórico: ${err?.message})`)
    return []
  })
  if (!historico.length) {
    console.log('  NENHUMA linha — nem enviada, nem barrada.')
    console.log('  → Isso significa que a passada não chegou a tentar: SMTP desligado,')
    console.log('    passada desligada, ou nenhuma conta paga venceu na janela ([4]).')
  }
  for (const row of historico.sort((a, b) => b._count._all - a._count._all)) {
    linha(`${row.slug} · ${row.status}${row.skipReason ? `:${row.skipReason}` : ''}`, row._count._all)
  }

  // [4] Tem alguém para receber? "Não saiu" e "não havia a quem mandar" são
  //     coisas diferentes e se parecem muito de fora.
  titulo('[4] Quem está vencido agora, e o que a jornada mandaria hoje')
  const vencidos = await db.user.findMany({
    where: {
      status: { notIn: ['banned', 'suspended'] },
      plan: { in: [...PAID_PLANS] },
      accessExpiresAt: { lt: now, gte: new Date(now.getTime() - 90 * MS_PER_DAY) },
    },
    select: { id: true, email: true, plan: true, accessExpiresAt: true },
    orderBy: { accessExpiresAt: 'desc' },
  }).catch(() => [])

  const foco = alvo ? vencidos.filter((u) => u.email?.toLowerCase() === alvo.toLowerCase()) : vencidos
  if (alvo && !foco.length) {
    console.log(`  Nenhuma conta PAGA vencida nos últimos 90 dias com o e-mail ${alvo}.`)
    console.log('  (conta em teste grátis tem trilha própria e não entra nesta jornada)')
  }
  linha('Contas pagas vencidas (90d):', vencidos.length)
  console.log('')
  for (const user of foco.slice(0, alvo ? 5 : 20)) {
    const vencidoHa = -daysUntil(user.accessExpiresAt, now)
    const hoje = resolveExpiredPlanEmail(vencidoHa)
    console.log(`  ${user.email} · ${user.plan} · venceu há ${vencidoHa}d · hoje: ${hoje ?? '(fora de janela)'}`)
    const enviados = await db.emailSendLog.findMany({
      where: { userId: user.id, slug: { in: SLUGS } },
      orderBy: { createdAt: 'desc' },
      select: { slug: true, status: true, skipReason: true, createdAt: true },
      take: 10,
    }).catch(() => [])
    if (!enviados.length) console.log('      (nenhum e-mail da jornada registrado para esta conta)')
    for (const row of enviados) {
      console.log(`      ${row.createdAt.toISOString()}  ${row.slug.padEnd(30)} ${row.status}${row.skipReason ? `:${row.skipReason}` : ''}`)
    }
  }

  console.log('\nComo ler os motivos de descarte:')
  console.log('  smtp_disabled  → SMTP fora: o e-mail nem foi tentado.')
  console.log('  already_sent   → janela anti-repetição do próprio e-mail (dedupDays).')
  console.log('  opted_out      → a cliente pediu para não receber divulgação.')
  console.log('  daily_cap      → teto diário estourado (campanha grande no mesmo dia).')
  console.log('  template_disabled → alguém desligou o texto na aba E-mails do admin.')
  console.log('')
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect().catch(() => {}))
