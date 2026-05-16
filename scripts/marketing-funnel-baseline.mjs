#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CORE_EVENTS = [
  'organic_page_view',
  'organic_cta_click',
  'signup_created',
  'first_send_success',
  'payment_approved',
]

function pct(a, b) {
  if (!b) return 0
  return Number(((a / b) * 100).toFixed(2))
}

async function main() {
  const days = Number(process.argv[2] || 7)
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw`
    SELECT event, COUNT(*) as total
    FROM AnalyticsEvent
    WHERE createdAt >= ${from}
      AND event IN (${CORE_EVENTS.join("','")})
    GROUP BY event
  `

  const counts = Object.fromEntries(CORE_EVENTS.map((event) => [event, 0]))
  for (const row of rows) counts[String(row.event)] = Number(row.total || 0)

  const cvrClick = pct(counts.organic_cta_click, counts.organic_page_view)
  const cvrSignup = pct(counts.signup_created, counts.organic_cta_click)
  const cvrActivation = pct(counts.first_send_success, counts.signup_created)
  const cvrPaid = pct(counts.payment_approved, counts.signup_created)

  console.log(JSON.stringify({
    windowDays: days,
    from: from.toISOString(),
    counts,
    conversion: {
      page_to_cta_pct: cvrClick,
      cta_to_signup_pct: cvrSignup,
      signup_to_activation_pct: cvrActivation,
      signup_to_paid_pct: cvrPaid,
    },
  }, null, 2))
}

main()
  .catch((err) => {
    console.error('[marketing-funnel-baseline] failed:', err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
