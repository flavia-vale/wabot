#!/usr/bin/env node
// Gera o contador público da home (B05): envios com sucesso nos últimos 30 dias.
// Read-only no banco; grava só um JSON pequeno. Roda 1x por dia, de madrugada:
// a contagem varre `MessageLog` e não deve rodar no horário de pico.
//
//   cd ~/wabot && node scripts/gerar-contadores-publicos.mjs
//
// Cron sugerido (uma linha, madrugada):  20 4 * * * cd ~/wabot && node scripts/gerar-contadores-publicos.mjs
// Prod e staging têm bancos próprios: rodar em cada diretório.
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import db from '../src/db.js'
import { buildCounterSnapshot, PUBLIC_COUNTER_WINDOW_DAYS } from '../src/domain/publicStats/publicCounters.js'

const target = process.env.PUBLIC_COUNTERS_FILE
  || path.join(process.cwd(), 'dashboard', 'data', 'contadores-publicos.json')

async function main() {
  const since = new Date(Date.now() - PUBLIC_COUNTER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const sends30d = await db.messageLog.count({ where: { status: 'success', sentAt: { gte: since } } })
  const snapshot = buildCounterSnapshot({ sends30d })
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(snapshot)}\n`)
  fs.renameSync(tmp, target)
  console.log(`Gravado em ${target}: ${snapshot.sends30d} envios em ${snapshot.windowDays} dias (${snapshot.generatedAt})`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect?.())
