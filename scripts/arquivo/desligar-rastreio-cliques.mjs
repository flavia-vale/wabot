#!/usr/bin/env node
// Desliga o "Link rastreado" (clique contado) das contas — decisão de 29/09/2026:
// por enquanto não vale o custo (o card mostra o nosso endereço em vez do da
// loja); só volta quando houver domínios próprios parecidos com os das lojas.
//
//   cd ~/wabot-staging && node scripts/desligar-rastreio-cliques.mjs            # só lista
//   cd ~/wabot-staging && node scripts/desligar-rastreio-cliques.mjs --aplicar  # desliga
//
// Sem --aplicar não escreve nada. Com --aplicar, muda só `clickTrackingEnabled`
// de true para false. Vale em até ~60 s (cache de configuração do robô), sem
// reiniciar nada. Em PRODUÇÃO, confirmar antes de usar --aplicar.
import 'dotenv/config'
import db from '../src/db.js'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}`)
  console.log(`SHORTLINK_BASE_URL no servidor: ${process.env.SHORTLINK_BASE_URL || '(não definido: o recurso já fica desligado)'}\n`)

  const ligadas = await db.botConfig.findMany({
    where: { clickTrackingEnabled: true },
    select: { userId: true, user: { select: { email: true, plan: true } } },
    take: 50,
  })
  console.log(`Contas com o rastreio ligado: ${ligadas.length}`)
  for (const row of ligadas) console.log(`  ${row.user?.email ?? row.userId} (${row.user?.plan ?? '?'})`)

  if (!ligadas.length) return console.log('\nNada a desligar.')
  if (!aplicar) return console.log('\nSó listei. Para desligar: rode de novo com --aplicar.')

  const res = await db.botConfig.updateMany({ where: { clickTrackingEnabled: true }, data: { clickTrackingEnabled: false } })
  console.log(`\nDesligado em ${res.count} conta(s). O robô passa a mandar o link direto da loja em até ~60 s.`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect?.())
