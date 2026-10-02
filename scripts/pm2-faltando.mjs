#!/usr/bin/env node
// Lista (um por linha) os apps esperados neste ambiente que NÃO estão no pm2.
// Só leitura. Usado pelo religar-producao.sh. Rode no diretório do ambiente
// (o .env decide BOT_SUPERVISOR_MODE / APP_ENV).
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { missingApps, parsePm2List, resolveExpectedApps } from '../src/ops/pm2Guard.js'

let raw
try {
  raw = execFileSync(process.env.PM2_BIN || 'pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 30_000 })
} catch (err) {
  console.error(`não consegui ler o pm2: ${err.message}`)
  process.exit(2)
}
for (const name of missingApps(parsePm2List(raw), resolveExpectedApps(process.env))) console.log(name)
